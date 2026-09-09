import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { readLimited, RequestError } from './server.ts';
import { readVideoEvents, configured } from './ltx.ts';
import { WAN_SPACE, validWanReference } from './wan-config.ts';
import type { WanReference } from './wan-config.ts';
import type { VideoPlan } from './types.ts';

const ENDPOINT = `${WAN_SPACE}/gradio_api/call/generate_video`;
const STOCK = new Set(['food', 'fitness', 'beauty', 'travel', 'productivity']);
function headers(): Record<string, string> {
  if (!configured())
    throw new RequestError('The Hugging Face token needs attention.', 503);
  const token = process.env.HUGGINGFACE_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function unavailable(status: number) {
  return new RequestError(
    status === 429
      ? 'The free video allowance or queue is full. Try later, or finish with stock assets.'
      : status === 401 || status === 403
        ? 'Hugging Face could not authorize Wan. Check the server token and demo access.'
        : 'The Wan video service is unavailable. Your brief is saved; try again later.',
    status === 429 ? 429 : 503,
  );
}
export async function prepareReference(
  plan: VideoPlan,
  dataUrl?: string,
): Promise<WanReference> {
  let bytes: Buffer;
  if (dataUrl !== undefined) {
    if (
      typeof dataUrl !== 'string' ||
      dataUrl.length > 1_100_000 ||
      !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl)
    )
      throw new RequestError(
        'Attach a JPG, PNG or WebP reference photo under 800 KB.',
      );
    bytes = Buffer.from(dataUrl.split(',')[1], 'base64');
  } else {
    const name = /^\/assets\/([a-z]+)\.jpg$/.exec(plan.background)?.[1];
    if (!name || !STOCK.has(name))
      throw new RequestError('Please attach a reference photo.');
    bytes = await readFile(
      path.join(process.cwd(), 'public', 'assets', `${name}.jpg`),
    );
  }
  let image: Buffer;
  const raster =
    bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ||
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (bytes.subarray(0, 4).toString() === 'RIFF' &&
      bytes.subarray(8, 12).toString() === 'WEBP');
  if (!raster)
    throw new RequestError('Attach a valid JPG, PNG or WebP reference photo.');
  try {
    image = await sharp(bytes, {
      limitInputPixels: 12_000_000,
      animated: false,
    })
      .rotate()
      .resize(480, 704, { fit: 'cover', position: 'centre' })
      .flatten({ background: '#181b13' })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch {
    throw new RequestError(
      'That reference photo could not be read. Try another JPG, PNG or WebP.',
    );
  }
  const body = new FormData();
  body.append(
    'files',
    new Blob([new Uint8Array(image)], { type: 'image/jpeg' }),
    'reference.jpg',
  );
  try {
    const response = await fetch(`${WAN_SPACE}/gradio_api/upload`, {
      method: 'POST',
      headers: headers(),
      body,
      signal: AbortSignal.timeout(20000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw unavailable(response.status);
    }
    const data = JSON.parse(
      new TextDecoder().decode(await readLimited(response, 4096)),
    );
    const ref = {
      path: Array.isArray(data) ? data[0] : null,
      source: dataUrl ? 'upload' : 'stock',
    };
    if (!validWanReference(ref))
      throw new RequestError(
        'The reference upload did not return a valid image. Please reattach it.',
        503,
      );
    return ref;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(
      'Could not send the reference photo to Wan. Please try again.',
      503,
    );
  }
}
export function motionPrompt(plan: VideoPlan, direction = '') {
  const calm = /calm|quiet|gentle|meditat|sleep|breath|relax/i.test(
    `${plan.description} ${direction}`,
  );
  const camera = /static|locked|tripod/i.test(direction)
    ? 'Keep the camera locked.'
    : calm
      ? 'A very slow, restrained camera push-in with soft background parallax.'
      : 'A slow handheld push-in with subtle, steady background parallax.';
  return [
    'Animate the supplied reference photograph into one continuous five-second shot.',
    'Keep the same visible subjects, product shape, composition, colors and setting. The reference image takes priority over the written product context.',
    camera,
    'Allow only small, physically plausible motion in subjects already visible. Do not invent a person, hands, a product, readable screens, logos or a new setting. Keep the central subject stable and recognizable; no morphing.',
    `Product context for mood only: ${plan.product}. ${plan.description}.`,
    `Mood: ${calm ? 'unhurried and reassuring' : 'natural, approachable and polished'}.`,
    'Maintain the original light direction. End with a brief settled hold. Keep the center clear and motion away from the top captions and lower-right reaction. No cuts, speech, text, subtitles, or new branding.',
  ]
    .join(' ')
    .slice(0, 2000);
}
export function mediaUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048)
    throw new RequestError('Wan returned an invalid video link.', 502);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError('Wan returned an invalid video link.', 502);
  }
  if (
    url.origin !== WAN_SPACE ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith('/gradio_api/file=') ||
    !url.pathname.endsWith('.mp4')
  )
    throw new RequestError('Wan returned an unexpected video location.', 502);
  return url.href;
}
export function parseComplete(value: unknown) {
  const output = Array.isArray(value) ? value[0] : null;
  return mediaUrl(
    output && typeof output === 'object' ? output.url : undefined,
  );
}
export async function submitVideo(
  plan: VideoPlan,
  direction = '',
): Promise<{ id: string }> {
  if (!validWanReference(plan.reference))
    throw new RequestError(
      'Attach a reference photo before generating this cut.',
    );
  const signal = AbortSignal.timeout(240000);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          { path: plan.reference.path, meta: { _type: 'gradio.FileData' } },
          motionPrompt(plan, direction),
          4,
          'blurry, flicker, distortion, morphing, deformed hands, extra limbs, new objects, camera shake, jump cuts, subtitles, watermark',
          5,
          1,
          1,
          42,
          true,
        ],
      }),
      signal,
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw unavailable(response.status);
    }
    const data = JSON.parse(
      new TextDecoder().decode(await readLimited(response, 4096)),
    );
    if (
      typeof data.event_id !== 'string' ||
      !/^[a-f0-9]{32}$/.test(data.event_id)
    )
      throw new RequestError(
        'Wan returned an invalid queue response. No automatic retry was made.',
        502,
      );
    const events = await fetch(`${ENDPOINT}/${data.event_id}`, {
      headers: headers(),
      signal,
      redirect: 'error',
      cache: 'no-store',
    });
    if (!events.ok) {
      await events.body?.cancel();
      throw unavailable(events.status);
    }
    const url = await readVideoEvents(events, parseComplete, 'Wan');
    return { id: `wan:${Buffer.from(url).toString('base64url')}` };
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(
      'Wan did not return a video in time. Your brief is saved; no automatic retry was made.',
      503,
    );
  }
}
export async function getVideoStatus(
  id: string,
): Promise<{ status: 'completed'; url: string }> {
  if (!/^wan:[A-Za-z0-9_-]{1,2800}$/.test(id))
    throw new RequestError('Invalid Wan video reference.', 400);
  return {
    status: 'completed',
    url: mediaUrl(Buffer.from(id.slice(4), 'base64url').toString('utf8')),
  };
}
