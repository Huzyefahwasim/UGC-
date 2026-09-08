import { env } from 'cloudflare:workers';
export const runtime = () =>
  env as unknown as {
    FILES: R2Bucket;
    OPENAI_API_KEY?: string;
    AI_BASE_URL?: string;
    AI_MODEL?: string;
  };
export async function readLimited(
  response: Pick<Response, 'body'>,
  max: number,
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty response');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error('Content is too large.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export async function rateLimit(request: Request) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(ip),
  );
  const id = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const bucket = Math.floor(Date.now() / 3600000);
  const key = `limits/${id}`;
  const stored = await runtime().FILES.get(key);
  const prior = stored
    ? await stored.json<{ bucket: number; count: number }>()
    : null;
  const count = prior?.bucket === bucket ? prior.count : 0;
  if (count >= 20)
    throw new Error('You’ve made lots of cuts! Please come back in an hour.');
  await runtime().FILES.put(key, JSON.stringify({ bucket, count: count + 1 }));
}
