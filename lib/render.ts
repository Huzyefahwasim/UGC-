import { parseGIF, decompressFrames } from 'gifuct-js';
import type { VideoPlan } from './types';
import { chooseReaction, reactionById } from './reactions';
const W = 540,
  H = 960;
function image(src: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    signal.throwIfAborted();
    const img = new Image();
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      img.onload = null;
      img.onerror = null;
    };
    const fail = (error: Error) => {
      cleanup();
      img.src = '';
      reject(error);
    };
    const abort = () => fail(new DOMException('Stopped', 'AbortError'));
    const timer = setTimeout(
      () =>
        fail(
          new Error('The background took too long to load. Please try again.'),
        ),
      12000,
    );
    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = () =>
      fail(new Error('A visual could not load. Please try again.'));
    signal.addEventListener('abort', abort, { once: true });
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
  const words = text.split(/\s+/).flatMap((word) => {
    if (ctx.measureText(word).width <= max) return [word];
    const pieces: string[] = [];
    let piece = '';
    for (const char of word) {
      if (piece && ctx.measureText(piece + char).width > max) {
        pieces.push(piece);
        piece = '';
      }
      piece += char;
    }
    if (piece) pieces.push(piece);
    return pieces;
  });
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) {
      result.push(line);
      line = word;
    } else line = next;
  }
  if (line) result.push(line);
  return result;
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value), 3);
function spring(value: number) {
  const t = clamp(value) - 1;
  return 1 + 2.4 * t * t * t + 1.4 * t * t;
}
function fittedText(
  ctx: CanvasRenderingContext2D,
  value: string,
  width: number,
) {
  if (ctx.measureText(value).width <= width) return value;
  let result = value;
  while (result && ctx.measureText(`${result}…`).width > width)
    result = result.slice(0, -1);
  return `${result.trimEnd()}…`;
}
export async function renderVideo(
  plan: VideoPlan,
  update: (progress: number, text: string) => void,
  signal: AbortSignal,
  audioContext?: AudioContext,
  footage?: HTMLVideoElement,
) {
  const DURATION = footage ? 6 : 8;
  const reaction = reactionById(
    plan.reaction || chooseReaction(plan.description, plan.category),
  );
  const quiet = reaction.mood === 'calm' || reaction.mood === 'thoughtful';
  const motion = quiet ? 0.3 : 1;
  let volume = quiet ? 0.5 : 0.6;
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    throw new Error(
      'Video rendering needs a recent Chrome, Edge, Firefox, or Safari browser.',
    );
  const audio = audioContext || new AudioContext();
  let stream: MediaStream | undefined;
  let source: AudioBufferSourceNode | undefined;
  const bitmaps: { image: ImageBitmap; end: number }[] = [];
  try {
    update(5, 'Picking the visuals and the perfect reaction…');
    const [photo, gifData, audioData] = await Promise.all([
      image(plan.background, signal),
      fetch(plan.gif, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      }).then((r) => {
        if (!r.ok) throw new Error('The reaction GIF could not load.');
        return r.arrayBuffer();
      }),
      fetch(plan.audio, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
      }).then((r) => {
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
    let total = 0;
    for (let i = 0; i < frames.length; i++) {
      signal.throwIfAborted();
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
          resizeWidth: 400,
          resizeHeight: 400,
        }),
        end: total,
      });
    }
    if (!bitmaps.length)
      throw new Error('The reaction GIF was empty. Please try again.');
    const buffer = await audio.decodeAudioData(audioData);
    if (quiet) {
      // Normalize the quiet intro to an audible level without clipping peaks.
      const samples = buffer.getChannelData(0);
      const end = Math.min(
        samples.length,
        Math.floor(buffer.sampleRate * DURATION),
      );
      let sum = 0,
        peak = 0,
        count = 0;
      for (let i = 0; i < end; i += 4) {
        sum += samples[i] * samples[i];
        peak = Math.max(peak, Math.abs(samples[i]));
        count++;
      }
      const rms = Math.sqrt(sum / Math.max(1, count));
      if (rms > 0.0001)
        volume = Math.min(3, 0.8 / Math.max(peak, 0.001), 0.055 / rms);
    }
    await audio.resume();
    if (audio.state !== 'running')
      throw new Error(
        'Your browser paused audio. Tap Try again to enable the soundtrack.',
      );
    update(15, 'Adding captions and lining up the beat…');
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    ctx.scale(720 / W, 1280 / H);
    stream = canvas.captureStream(30);
    const destination = audio.createMediaStreamDestination();
    const gain = audio.createGain();
    gain.gain.value = volume;
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
      videoBitsPerSecond: 3000000,
      audioBitsPerSecond: 128000,
    });
    const chunks: Blob[] = [];
    const ivory = '#f7f5e9';
    const lime = /^#[0-9a-f]{6}$/i.test(plan.accent) ? plan.accent : '#d3fb79';
    const starts = [0, DURATION / 3, (DURATION * 2) / 3];
    const lengths = [DURATION / 3, DURATION / 3, DURATION / 3];
    const titles = quiet
      ? ['A MOMENT FOR YOU', 'A LITTLE EVERY DAY', 'MAKE ROOM FOR IT']
      : ['FOUND YOUR NEXT FAVORITE', 'HERE’S THE GOOD PART', 'GIVE IT A TRY'];
    const captionLayouts = plan.captions.map((caption) => {
      let size = quiet ? 46 : 56;
      ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
      let rows = lines(ctx, caption, W - 100);
      while (rows.length > (quiet ? 3 : 4) && size > 26) {
        size -= 2;
        ctx.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
        rows = lines(ctx, caption, W - 100);
      }
      return { size, rows, lineHeight: size * 1.1 };
    });
    // The soundtrack itself supplies the pulse, so the reaction and equalizer
    // follow the music instead of moving at an unrelated, arbitrary tempo.
    const samples = buffer.getChannelData(0);
    const sampleWindow = Math.max(1, Math.floor(buffer.sampleRate / 30));
    const levels = Array.from({ length: DURATION * 30 }, (_, frame) => {
      const first = frame * sampleWindow;
      const last = Math.min(first + sampleWindow, samples.length);
      let sum = 0;
      let count = 0;
      for (let i = first; i < last; i += 4) {
        sum += samples[i] * samples[i];
        count++;
      }
      return Math.sqrt(sum / Math.max(1, count));
    });
    const peak = Math.max(...levels, 0.001);
    const levelAt = (t: number) =>
      clamp(
        (levels[Math.min(levels.length - 1, Math.floor(t * 30))] || 0) / peak,
      );
    const domain = plan.url
      ? new URL(plan.url).hostname.replace(/^www\./, '')
      : 'Meet your new favorite.';

    function photograph(scene: number, local: number) {
      if (footage) {
        const scale = Math.max(W / footage.videoWidth, H / footage.videoHeight);
        ctx.drawImage(
          footage,
          (W - footage.videoWidth * scale) / 2,
          (H - footage.videoHeight * scale) / 2,
          footage.videoWidth * scale,
          footage.videoHeight * scale,
        );
        return;
      }
      const progress = easeOut(local / lengths[scene]);
      const zoom = [
        1.045 + progress * 0.075,
        1.155 - progress * 0.045,
        1.085 + progress * 0.065,
      ][scene];
      const scale = Math.max(W / photo.width, H / photo.height) * zoom;
      const width = photo.width * scale;
      const height = photo.height * scale;
      const pan = [-0.16 + progress * 0.2, 0.16 - progress * 0.2, -0.08][scene];
      ctx.drawImage(
        photo,
        (W - width) / 2 + ((width - W) / 2) * pan,
        (H - height) / 2 + ((height - H) / 2) * (0.12 - progress * 0.16),
        width,
        height,
      );
    }

    function draw(t: number) {
      const scene = t < starts[1] ? 0 : t < starts[2] ? 1 : 2;
      const local = t - starts[scene];
      const remaining = lengths[scene] - local;
      const level = levelAt(t);
      photograph(scene, local);
      if (scene > 0 && local < 0.2) {
        ctx.save();
        ctx.globalAlpha = 1 - easeOut(local / 0.2);
        photograph(scene - 1, lengths[scene - 1]);
        ctx.restore();
      }
      const shade = ctx.createLinearGradient(0, 0, 0, H);
      shade.addColorStop(0, 'rgba(9,12,10,.78)');
      shade.addColorStop(0.34, 'rgba(9,12,10,.55)');
      shade.addColorStop(0.58, 'rgba(9,12,10,.05)');
      shade.addColorStop(0.8, 'rgba(9,12,10,.44)');
      shade.addColorStop(1, 'rgba(9,12,10,.92)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);

      // Keep the labels, captions, reaction and product inside the same safe
      // area throughout all three beats; the motion comes from their entrances.
      ctx.save();
      ctx.globalAlpha = quiet ? 0 : easeOut(local / 0.2);
      ctx.translate(0, (1 - easeOut(local / 0.3)) * 10);
      ctx.fillStyle = 'rgba(12,16,12,.56)';
      rounded(ctx, 34, 62, 266, 38, 19);
      ctx.fillStyle = lime;
      rounded(ctx, 49, 77, 8, 8, 4);
      ctx.fillStyle = ivory;
      ctx.font = '700 13px Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(titles[scene], 70, 81);
      ctx.fillStyle = 'rgba(247,245,233,.14)';
      rounded(ctx, W - 92, 62, 58, 38, 19);
      ctx.fillStyle = ivory;
      ctx.textAlign = 'center';
      ctx.fillText(`0${scene + 1}`, W - 63, 81);
      ctx.restore();

      const layout = captionLayouts[scene];
      const captionExit = scene < 2 ? clamp(remaining / 0.14) : 1;
      const captionTop =
        (quiet ? 153 : 255) -
        ((layout.rows.length - 1) * layout.lineHeight) / 2;
      layout.rows.forEach((line, i) => {
        const arrival = (local - i * 0.055) / 0.32;
        const reveal = easeOut(arrival);
        const last = i === layout.rows.length - 1;
        ctx.save();
        ctx.globalAlpha = reveal * captionExit;
        ctx.translate(
          W / 2,
          captionTop + i * layout.lineHeight + (1 - reveal) * 28,
        );
        const scale = quiet ? 1 : 0.96 + spring(arrival) * 0.04;
        ctx.scale(scale, scale);
        ctx.font = `900 ${layout.size}px "Arial Black", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (last) {
          ctx.rotate(quiet ? 0 : -0.028);
          const width = ctx.measureText(line).width + 24;
          ctx.fillStyle = lime;
          rounded(
            ctx,
            -width / 2,
            -layout.size * 0.56,
            width,
            layout.size * 1.12,
            5,
          );
          ctx.fillStyle = '#151a10';
          ctx.fillText(line, 0, 1);
        } else {
          ctx.shadowColor = 'rgba(0,0,0,.3)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 3;
          ctx.fillStyle = ivory;
          ctx.fillText(line, 0, 0);
        }
        ctx.restore();
      });

      const frame =
        bitmaps.find((f) => f.end > (t * 1000) % total) || bitmaps[0];
      const arrival = quiet ? easeOut(local / 0.65) : spring(local / 0.52);
      const pulse = 1 + level * 0.024 * motion;
      const reactionY = (footage ? 678 : 593) + Math.sin(t * 1.6) * 6 * motion;
      ctx.save();
      ctx.translate(
        (footage ? W - 126 : W / 2) + Math.sin(t * 1.5) * 8 * motion,
        reactionY,
      );
      const halo = ctx.createRadialGradient(0, 5, 75, 0, 5, 224);
      halo.addColorStop(0, 'rgba(8,12,7,.22)');
      halo.addColorStop(0.64, 'rgba(8,12,7,.12)');
      halo.addColorStop(1, 'rgba(8,12,7,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(-224, -219, 448, 448);
      ctx.rotate((Math.sin(t * 1.8) * 0.025 + (1 - arrival) * -0.09) * motion);
      const reactionScale = (0.86 + arrival * 0.14) * pulse;
      ctx.scale(reactionScale, reactionScale);
      ctx.shadowColor = 'rgba(0,0,0,.28)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 12;
      const reactionSize = footage ? (quiet ? 160 : 185) : quiet ? 280 : 340;
      ctx.drawImage(
        frame.image,
        -reactionSize / 2,
        -reactionSize / 2,
        reactionSize,
        reactionSize,
      );
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = easeOut((local - 0.22) / 0.22);
      ctx.translate(footage ? W - 126 : W / 2, footage ? 772 : 787);
      ctx.rotate(quiet ? 0 : 0.025);
      ctx.fillStyle = ivory;
      ctx.font = '700 12px Arial, sans-serif';
      const tagWidth = Math.min(
        222,
        ctx.measureText(reaction.label).width + 24,
      );
      rounded(ctx, -tagWidth / 2, -16, tagWidth, 32, 9);
      ctx.fillStyle = '#181d14';
      ctx.font = '700 12px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fittedText(ctx, reaction.label, tagWidth - 20), 0, 1);
      ctx.restore();

      const brandArrival = easeOut(t / 0.45);
      ctx.save();
      ctx.globalAlpha = brandArrival;
      ctx.translate(0, (1 - brandArrival) * 20);
      ctx.fillStyle = 'rgba(15,20,13,.89)';
      rounded(ctx, 34, 801, W - 68, 83, 16);
      ctx.strokeStyle = 'rgba(247,245,233,.19)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ivory;
      ctx.font = '700 25px Arial, sans-serif';
      ctx.fillText(fittedText(ctx, plan.product, W - 182), 54, 828);
      ctx.fillStyle = 'rgba(247,245,233,.68)';
      ctx.font = '14px Arial, sans-serif';
      ctx.fillText(fittedText(ctx, domain, W - 182), 54, 858);
      ctx.fillStyle = lime;
      rounded(ctx, W - 103, 820, 46, 46, 23);
      ctx.strokeStyle = '#171d10';
      ctx.lineWidth = 2.3;
      ctx.lineCap = 'round';
      const arrowShift =
        scene === 2 ? Math.sin(clamp(local / 0.6) * Math.PI) * 3 : 0;
      ctx.beginPath();
      ctx.moveTo(W - 88 - arrowShift, 851 + arrowShift);
      ctx.lineTo(W - 73 + arrowShift, 836 - arrowShift);
      ctx.moveTo(W - 87 + arrowShift, 836 - arrowShift);
      ctx.lineTo(W - 73 + arrowShift, 836 - arrowShift);
      ctx.lineTo(W - 73 + arrowShift, 850 - arrowShift);
      ctx.stroke();
      ctx.restore();

      const segmentWidth = 123;
      for (let i = 0; i < 3; i++) {
        const x = 34 + i * (segmentWidth + 7);
        ctx.fillStyle = 'rgba(247,245,233,.25)';
        rounded(ctx, x, 906, segmentWidth, 3, 1.5);
        const progress = clamp((t - starts[i]) / lengths[i]);
        if (progress > 0) {
          ctx.fillStyle = lime;
          rounded(ctx, x, 906, segmentWidth * progress, 3, 1.5);
        }
      }
      for (let i = 0; i < 7; i++) {
        const bar = 3 + levelAt(Math.max(0, t - i * 0.035)) * (i % 2 ? 13 : 19);
        ctx.fillStyle = i < 4 ? lime : 'rgba(247,245,233,.6)';
        rounded(ctx, 450 + i * 8, 907 - bar / 2, 3, bar, 1.5);
      }
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(247,245,233,.65)';
      ctx.font = '8.5px Arial, sans-serif';
      ctx.fillText(
        `${footage ? 'AI footage · LTX-Video | ' : ''}Emoji: Google Noto · CC BY 4.0 · composited`,
        W / 2,
        934,
      );
    }
    signal.throwIfAborted();
    if (footage) {
      footage.currentTime = 0;
      footage.playbackRate = Math.max(
        0.5,
        Math.min(2, footage.duration / DURATION),
      );
      await footage.play();
    }
    draw(0.65);
    const poster = canvas.toDataURL('image/jpeg', 0.85);
    draw(0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      const start = performance.now();
      const cleanup = () => {
        clearInterval(timer);
        signal.removeEventListener('abort', abort);
        document.removeEventListener('visibilitychange', visibility);
      };
      const visibility = () => {
        if (document.visibilityState !== 'hidden') return;
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(
          new Error(
            'Rendering paused when this tab was hidden. Keep it visible and try again.',
          ),
        );
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
      document.addEventListener('visibilitychange', visibility);
      recorder.start(250);
      source!.start(0, 0, DURATION);
      gain.gain.setValueAtTime(volume, audio.currentTime + DURATION - 0.5);
      gain.gain.linearRampToValueAtTime(0, audio.currentTime + DURATION);
      const timer = setInterval(() => {
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
    if (blob.size < 10000)
      throw new Error('The video was incomplete. Please try again.');
    return { blob, poster };
  } finally {
    footage?.pause();
    bitmaps.forEach((f) => f.image.close());
    try {
      source?.stop();
    } catch {}
    stream?.getTracks().forEach((t) => t.stop());
    if (!audioContext) await audio.close();
  }
}
