export async function loadFootage(
  url: string,
  signal: AbortSignal,
): Promise<HTMLVideoElement> {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  await new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      video.onloadeddata = null;
      video.onerror = null;
    };
    const fail = (message: string) => {
      cleanup();
      video.removeAttribute('src');
      video.load();
      reject(new Error(message));
    };
    const abort = () =>
      fail('Finishing stopped. Resume to use the same footage.');
    const timer = setTimeout(
      () =>
        fail(
          'The generated footage took too long to load. Resume to try the same footage again.',
        ),
      30_000,
    );
    video.onloadeddata = () => {
      if (
        !video.videoWidth ||
        !Number.isFinite(video.duration) ||
        video.duration < 1
      )
        return fail('The generated footage could not be decoded.');
      cleanup();
      resolve();
    };
    video.onerror = () =>
      fail(
        'The generated footage could not load. Its temporary link may have expired. You can use free assets instead.',
      );
    signal.addEventListener('abort', abort, { once: true });
    video.src = url;
    video.load();
  });
  return video;
}
