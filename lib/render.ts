import { parseGIF, decompressFrames } from 'gifuct-js';
import type { VideoPlan } from './types';
const W = 540,
  H = 960,
  DURATION = 8;
function image(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('A visual could not load. Please try again.'));
    img.src = src;
  });
}
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}
function lines(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const result: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      result.push(line);
      line = word;
    } else line = next;
  }
  if (line) result.push(line);
  return result;
}
export async function renderVideo(
  plan: VideoPlan,
  update: (progress: number, text: string) => void,
  signal: AbortSignal,
  audioContext?: AudioContext,
) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    throw new Error(
      'Video rendering needs a recent Chrome, Edge, Firefox, or Safari browser.',
    );
  const audio = audioContext || new AudioContext();
  let stream: MediaStream | undefined;
  let source: AudioBufferSourceNode | undefined;
  try {
    update(5, 'Picking the visuals and the perfect reaction…');
    const [photo, gifData, audioData] = await Promise.all([
      image(plan.background),
      fetch(plan.gif, { signal }).then((r) => {
        if (!r.ok) throw new Error('The reaction GIF could not load.');
        return r.arrayBuffer();
      }),
      fetch(plan.audio, { signal }).then((r) => {
        if (!r.ok) throw new Error('The soundtrack could not load.');
        return r.arrayBuffer();
      }),
    ]);
    signal.throwIfAborted();
    const parsed = parseGIF(gifData);
    const frames = decompressFrames(parsed, true);
    const gifCanvas = document.createElement('canvas');
    gifCanvas.width = parsed.lsd.width;
    gifCanvas.height = parsed.lsd.height;
    const g = gifCanvas.getContext('2d')!;
    const patchCanvas = document.createElement('canvas');
    const patch = patchCanvas.getContext('2d')!;
    const bitmaps: { image: ImageBitmap; end: number }[] = [];
    let total = 0;
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i],
        previous = frames[i - 1];
      if (previous?.disposalType === 2)
        g.clearRect(
          previous.dims.left,
          previous.dims.top,
          previous.dims.width,
          previous.dims.height,
        );
      patchCanvas.width = frame.dims.width;
      patchCanvas.height = frame.dims.height;
      patch.putImageData(
        new ImageData(
          new Uint8ClampedArray(frame.patch),
          frame.dims.width,
          frame.dims.height,
        ),
        0,
        0,
      );
      g.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
      total += Math.max(frame.delay, 30);
      bitmaps.push({
        image: await createImageBitmap(gifCanvas, {
          resizeWidth: 300,
          resizeHeight: 300,
        }),
        end: total,
      });
    }
    const buffer = await audio.decodeAudioData(audioData);
    await audio.resume();
    if (audio.state !== 'running')
      throw new Error(
        'Your browser paused audio. Tap Try again to enable the soundtrack.',
      );
    update(15, 'Adding captions and lining up the beat…');
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    stream = canvas.captureStream(30);
    const destination = audio.createMediaStreamDestination();
    const gain = audio.createGain();
    gain.gain.value = 0.6;
    gain.connect(destination);
    source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    for (const track of destination.stream.getAudioTracks())
      stream.addTrack(track);
    const mime = [
      'video/mp4;codecs=avc1.42001E,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find((type) => MediaRecorder.isTypeSupported(type));
    if (!mime)
      throw new Error(
        'This browser cannot encode video. Please try Chrome or Edge.',
      );
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 2200000,
      audioBitsPerSecond: 128000,
    });
    const chunks: Blob[] = [];
    function draw(t: number) {
      const scene = t < 2.7 ? 0 : t < 5.4 ? 1 : 2,
        local = t - [0, 2.7, 5.4][scene];
      const scale =
        Math.max(W / photo.width, H / photo.height) * (1.04 + t * 0.011);
      ctx.drawImage(
        photo,
        (W - photo.width * scale) / 2,
        (H - photo.height * scale) / 2,
        photo.width * scale,
        photo.height * scale,
      );
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(0,0,0,.7)');
      shade.addColorStop(0.5, 'rgba(0,0,0,.1)');
      shade.addColorStop(1, 'rgba(0,0,0,.68)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, 143);
      ctx.rotate(-0.045);
      ctx.fillStyle = plan.accent;
      rounded(ctx, -116, -22, 232, 39, 7);
      ctx.fillStyle = '#20241a';
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px Arial';
      ctx.fillText(
        scene === 0
          ? 'POV: YOU FOUND IT'
          : scene === 1
            ? 'WAIT FOR IT…'
            : 'YOUR NEXT OBSESSION',
        0,
        3,
      );
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.min(1, local * 7);
      ctx.translate(0, Math.max(0, 1 - local * 6) * 18);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let size = 42;
      ctx.font = `900 ${size}px Arial`;
      let textLines = lines(ctx, plan.captions[scene], W - 90);
      while (textLines.length > 3 && size > 25) {
        size -= 2;
        ctx.font = `900 ${size}px Arial`;
        textLines = lines(ctx, plan.captions[scene], W - 90);
      }
      textLines.slice(0, 4).forEach((line, i) => {
        const y = 230 + i * (size + 10);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,.7)';
        ctx.lineWidth = 7;
        ctx.strokeText(line, W / 2, y);
        ctx.fillStyle = '#fff';
        ctx.fillText(line, W / 2, y);
      });
      ctx.restore();
      const frame =
        bitmaps.find((f) => f.end > (t * 1000) % total) || bitmaps[0];
      const bounce = 1 + Math.sin(t * Math.PI * 3) * 0.025;
      ctx.save();
      ctx.translate(W / 2 + Math.sin(t * 1.8) * 12, 620);
      ctx.rotate(Math.sin(t * 2) * 0.05);
      ctx.scale(bounce, bounce);
      ctx.shadowColor = 'rgba(0,0,0,.25)';
      ctx.shadowBlur = 25;
      ctx.drawImage(frame.image, -150, -150, 300, 300);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = plan.accent;
      ctx.font = 'bold 25px Arial';
      const brand =
        plan.product.length > 28
          ? plan.product.slice(0, 27) + '…'
          : plan.product;
      ctx.fillText(brand, W / 2, 820);
      ctx.fillStyle = '#fff';
      ctx.font = '14px Arial';
      ctx.fillText(
        plan.url ? new URL(plan.url).hostname : 'Meet your new favorite.',
        W / 2,
        850,
      );
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      rounded(ctx, 45, 904, 450, 3, 2);
      ctx.fillStyle = plan.accent;
      rounded(ctx, 45, 904, 450 * Math.min(t / DURATION, 1), 3, 2);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.font = '9px Arial';
      ctx.fillText(
        'Animated emoji: Google Noto · CC BY 4.0 · resized / composited',
        W / 2,
        927,
      );
    }
    signal.throwIfAborted();
    draw(0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      let timer: ReturnType<typeof setInterval>;
      const start = performance.now();
      const cleanup = () => {
        clearInterval(timer);
        signal.removeEventListener('abort', abort);
      };
      const abort = () => {
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(new DOMException('Stopped', 'AbortError'));
      };
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onerror = () => {
        cleanup();
        reject(
          new Error('The browser could not finish encoding. Please try again.'),
        );
      };
      recorder.onstop = () => {
        cleanup();
        resolve(new Blob(chunks, { type: recorder.mimeType }));
      };
      signal.addEventListener('abort', abort, { once: true });
      recorder.start(250);
      source!.start(0, 0, DURATION);
      gain.gain.setValueAtTime(0.6, audio.currentTime + DURATION - 0.5);
      gain.gain.linearRampToValueAtTime(0, audio.currentTime + DURATION);
      timer = setInterval(() => {
        const t = (performance.now() - start) / 1000;
        draw(Math.min(t, DURATION));
        update(
          20 + Math.min(t / DURATION, 1) * 72,
          `Rendering your ${plan.product} video…`,
        );
        if (t >= DURATION) {
          clearInterval(timer);
          recorder.stop();
        }
      }, 1000 / 30);
    });
    bitmaps.forEach((f) => f.image.close());
    if (blob.size < 10000)
      throw new Error('The video was incomplete. Please try again.');
    return blob;
  } finally {
    try {
      source?.stop();
    } catch {}
    stream?.getTracks().forEach((t) => t.stop());
    if (!audioContext) await audio.close();
  }
}
