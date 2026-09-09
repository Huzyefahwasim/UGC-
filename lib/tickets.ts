import { setting } from './config.ts';
import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { mkdir, readFile, writeFile, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { isVideoId, localDataDirectory, requireStorage } from './storage.ts';
import { RequestError } from './server.ts';

const LIFETIME = 15 * 60 * 1000;
type RenderPermit = { v: 1; id: string; expires: number; product: string };

async function signingKey() {
  requireStorage();
  const configured =
    setting('RENDER_SIGNING_SECRET') || setting('BLOB_READ_WRITE_TOKEN');
  if (configured)
    return createHmac('sha256', configured)
      .update('cut-render-tickets-v1')
      .digest();
  const directory = localDataDirectory();
  await mkdir(directory, { recursive: true });
  const keyFile = path.join(directory, 'render-signing-key');
  const temporary = path.join(
    directory,
    `render-signing-key.${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporary, randomBytes(32), { flag: 'wx', mode: 0o600 });
    await link(temporary, keyFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  } finally {
    await unlink(temporary).catch(() => {});
  }
  const key = await readFile(keyFile);
  if (key.length !== 32)
    throw new RequestError(
      'Local video storage needs attention. Please restart the app.',
      503,
    );
  return key;
}

export async function createRenderTicket(product: string): Promise<string> {
  const key = await signingKey();
  const permit: RenderPermit = {
    v: 1,
    id: randomUUID(),
    expires: Date.now() + LIFETIME,
    product: product.trim().slice(0, 160),
  };
  const payload = Buffer.from(JSON.stringify(permit)).toString('base64url');
  const signature = createHmac('sha256', key)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export async function verifyRenderTicket(
  ticket: string,
): Promise<RenderPermit> {
  const invalid = () =>
    new RequestError(
      'This render expired or is invalid. Please start a new cut.',
      403,
    );
  if (
    ticket.length > 2048 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(ticket)
  )
    throw invalid();
  const [payload, signature] = ticket.split('.');
  const expected = createHmac('sha256', await signingKey())
    .update(payload)
    .digest();
  const received = Buffer.from(signature, 'base64url');
  if (
    received.toString('base64url') !== signature ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw invalid();
  let permit: RenderPermit;
  try {
    permit = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  if (
    !permit ||
    permit.v !== 1 ||
    !isVideoId(permit.id) ||
    typeof permit.product !== 'string' ||
    permit.product.length > 160 ||
    !Number.isSafeInteger(permit.expires) ||
    permit.expires <= Date.now() ||
    permit.expires > Date.now() + LIFETIME + 30_000
  )
    throw invalid();
  return permit;
}
