import { createHash } from 'node:crypto';

export const runtime = () => ({
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  AI_BASE_URL: process.env.AI_BASE_URL,
  AI_MODEL: process.env.AI_MODEL,
});

export class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}
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
      if (size > max) throw new RequestError('Content is too large.', 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
// A small per-process backstop. Use Vercel Firewall for limits shared across instances.
const counters = new Map<string, { bucket: number; count: number }>();
export async function rateLimit(request: Request) {
  const ip = process.env.VERCEL
    ? (
        request.headers.get('x-vercel-forwarded-for') ||
        request.headers.get('x-forwarded-for') ||
        'unknown'
      )
        .split(',')[0]
        .trim()
    : 'local';
  const id = createHash('sha256').update(ip).digest('hex');
  const bucket = Math.floor(Date.now() / 3600000);
  const prior = counters.get(id);
  const count = prior?.bucket === bucket ? prior.count : 0;
  if (count >= 20)
    throw new RequestError(
      'You’ve made lots of cuts! Please come back in an hour.',
      429,
    );
  if (counters.size >= 5000 && !counters.has(id)) {
    for (const [key, value] of counters)
      if (value.bucket !== bucket) counters.delete(key);
    if (counters.size >= 5000) counters.delete(counters.keys().next().value!);
  }
  counters.set(id, { bucket, count: count + 1 });
}
