import { readLimited, RequestError } from './server.ts';
import { NEGATIVE_PROMPT, videoPrompt } from './video-direction.ts';
import type { VideoPlan } from './types.ts';

export const LTX_SPACE = 'https://lightricks-ltx-video-distilled.hf.space';
export const LTX_DEMO =
  'https://huggingface.co/spaces/Lightricks/ltx-video-distilled';
const ENDPOINT = `${LTX_SPACE}/gradio_api/call/text_to_video`;
const EVENT_ID = /^[a-f0-9]{32}$/;
const MAX_RESPONSE = 64 * 1024;

export const configured = () =>
  !process.env.HUGGINGFACE_TOKEN?.trim() ||
  /^hf_[A-Za-z0-9]+$/.test(process.env.HUGGINGFACE_TOKEN.trim());
export const authenticated = () =>
  Boolean(process.env.HUGGINGFACE_TOKEN?.trim());

function headers(): Record<string, string> {
  if (!configured())
    throw new RequestError(
      'The Hugging Face token needs attention. Check HUGGINGFACE_TOKEN on the server.',
      503,
    );
  const token = process.env.HUGGINGFACE_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function mediaUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 2048)
    throw new RequestError('LTX returned an invalid video link.', 502);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RequestError('LTX returned an invalid video link.', 502);
  }
  if (
    url.origin !== LTX_SPACE ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith('/gradio_api/file=') ||
    !url.pathname.endsWith('.mp4')
  )
    throw new RequestError('LTX returned an unexpected video location.', 502);
  return url.href;
}

function unavailable(status: number): RequestError {
  if (status === 401 || status === 403)
    return new RequestError(
      'Hugging Face could not authorize generation. Add a valid HUGGINGFACE_TOKEN or check access in the official LTX demo.',
      503,
    );
  if (status === 429)
    return new RequestError(
      'The free GPU queue or daily allowance is full. Try later, or make a cut with free assets.',
      429,
    );
  return new RequestError(
    'The free LTX demo is unavailable right now. Try later, or make a cut with free assets.',
    503,
  );
}

export function parseComplete(value: unknown): string {
  const output = Array.isArray(value) ? value[0] : null;
  const url =
    output && typeof output === 'object' ? output.video?.url : undefined;
  return mediaUrl(url);
}

export async function readVideoEvents(
  response: Response,
  parseResult = parseComplete,
  provider = 'LTX',
): Promise<string> {
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    await response.body?.cancel();
    throw new RequestError(
      `${provider} did not return a generation stream.`,
      502,
    );
  }
  const reader = response.body?.getReader();
  if (!reader)
    throw new RequestError(`The ${provider} generation stream was empty.`, 502);
  const decoder = new TextDecoder();
  let buffer = '',
    size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_RESPONSE)
        throw new RequestError(
          `The ${provider} response exceeded its size limit.`,
          502,
        );
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) >= 0) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const kind = event.match(/^event:\s*(\S+)/m)?.[1];
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (kind === 'error') {
          // Gradio's simple API sometimes returns null even for quota errors.
          // Do not echo arbitrary upstream exception strings or invent a cause.
          throw new RequestError(
            'The video service could not complete this request. Your brief is saved; retry later or finish with stock assets.',
            503,
          );
        }
        if (kind === 'complete') {
          try {
            return parseResult(JSON.parse(data));
          } catch (error) {
            if (error instanceof RequestError) throw error;
            throw new RequestError(
              `${provider} returned an unreadable result.`,
              502,
            );
          }
        }
      }
    }
    throw new RequestError(
      `${provider} disconnected before returning a video. No new generation was submitted automatically.`,
      502,
    );
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function submitVideo(
  plan: VideoPlan,
  direction = '',
): Promise<{ id: string }> {
  // Gradio 5.42 cancels its queue when the SSE connection closes. Keep ONE
  // connection alive, under Vercel's 300s function limit, and save the completed
  // URL before responding. Never emulate polling by reconnecting to this stream.
  const signal = AbortSignal.timeout(240_000);
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [
          videoPrompt(plan, direction),
          NEGATIVE_PROMPT,
          null,
          null,
          1024,
          576,
          'text-to-video',
          6,
          9,
          42,
          true,
          1,
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
    const bytes = await readLimited(response, 4096);
    const result = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof result.event_id !== 'string' || !EVENT_ID.test(result.event_id))
      throw new RequestError(
        'LTX returned an invalid queue ID. No retry was submitted.',
        502,
      );
    const events = await fetch(`${ENDPOINT}/${result.event_id}`, {
      headers: headers(),
      signal,
      redirect: 'error',
      cache: 'no-store',
    });
    if (!events.ok) {
      await events.body?.cancel();
      throw unavailable(events.status);
    }
    const url = await readVideoEvents(events);
    // This is an encrypted completed-result reference, not an active provider job
    // ID. Storing it makes reloads/retries independent of Gradio's consumed stream.
    return { id: `ltx:${Buffer.from(url).toString('base64url')}` };
  } catch (error) {
    if (error instanceof RequestError) throw error;
    if (signal.aborted)
      throw new RequestError(
        'The free LTX queue took over four minutes. Tracking ended; try later or use free assets. No automatic retry was made.',
        503,
      );
    throw new RequestError(
      'The connection to LTX ended before a video was received. Try the official demo or use free assets.',
      503,
    );
  }
}

export async function getVideoStatus(
  id: string,
): Promise<{ status: 'completed'; url: string }> {
  if (!/^ltx:[A-Za-z0-9_-]{1,2800}$/.test(id))
    throw new RequestError(
      'This video belongs to an older engine. Please start a new LTX cut.',
      400,
    );
  return {
    status: 'completed',
    url: mediaUrl(Buffer.from(id.slice(4), 'base64url').toString('utf8')),
  };
}
