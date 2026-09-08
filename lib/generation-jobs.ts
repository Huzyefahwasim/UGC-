import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { link, mkdir, open, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BlobNotFoundError, head, put } from '@vercel/blob';
import { readLimited, RequestError } from './server.ts';
import {
  isVideoId,
  localDataDirectory,
  requireStorage,
  storageMode,
} from './storage.ts';
import type { VideoPlan } from './types.ts';

const LIFETIME = 24 * 60 * 60 * 1000;
const MAX_TICKET_LENGTH = 7800;
const MAX_RECORD_BYTES = 8192;
const PURPOSE = 'cut-higgsfield-generation';
type GenerationTicket = {
  v: 1;
  purpose: typeof PURPOSE;
  id: string;
  plan: VideoPlan;
  direction: string;
  expires: number;
};
type GenerationResult = { providerId?: string; error?: string };
type RecordKind = 'claim' | 'result';

function keyFor(purpose: 'ticket' | 'record') {
  const secret =
    process.env.RENDER_SIGNING_SECRET?.trim() ||
    process.env.HF_API_KEY_SECRET?.trim();
  if (!secret)
    throw new RequestError(
      'Video generation is not connected yet. Ask the site owner to configure Higgsfield.',
      503,
    );
  return createHmac('sha256', secret)
    .update(`${PURPOSE}:${purpose}:v1`)
    .digest();
}

function invalidTicket() {
  return new RequestError(
    'This generation expired or is invalid. Please start a new video.',
    403,
  );
}

function validPlan(value: unknown): value is VideoPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as Record<string, unknown>;
  const strings = [
    'product',
    'url',
    'description',
    'background',
    'gif',
    'audio',
    'accent',
  ];
  return (
    strings.every(
      (name) => typeof plan[name] === 'string' && plan[name].length <= 4096,
    ) &&
    typeof plan.category === 'string' &&
    ['food', 'fitness', 'productivity', 'beauty', 'travel', 'general'].includes(
      plan.category,
    ) &&
    Array.isArray(plan.captions) &&
    plan.captions.length === 3 &&
    plan.captions.every(
      (caption) => typeof caption === 'string' && caption.length <= 500,
    ) &&
    Array.isArray(plan.credits) &&
    plan.credits.length <= 20 &&
    plan.credits.every(
      (credit) =>
        credit &&
        typeof credit.label === 'string' &&
        credit.label.length <= 160 &&
        typeof credit.url === 'string' &&
        credit.url.length <= 2048,
    )
  );
}

export async function createGenerationTicket(
  plan: VideoPlan,
  direction: string,
): Promise<string> {
  requireStorage();
  const key = keyFor('ticket');
  if (
    !validPlan(plan) ||
    typeof direction !== 'string' ||
    direction.length > 4000
  )
    throw new RequestError('The video brief is too long or incomplete.');
  const permit: GenerationTicket = {
    v: 1,
    purpose: PURPOSE,
    id: randomUUID(),
    plan,
    direction: direction.trim(),
    expires: Date.now() + LIFETIME,
  };
  const payload = Buffer.from(JSON.stringify(permit)).toString('base64url');
  const signature = createHmac('sha256', key)
    .update(payload)
    .digest('base64url');
  const ticket = `${payload}.${signature}`;
  if (ticket.length > MAX_TICKET_LENGTH)
    throw new RequestError('The video brief is too long. Please shorten it.');
  return ticket;
}

export async function verifyGenerationTicket(ticket: string): Promise<{
  id: string;
  plan: VideoPlan;
  direction: string;
  expires: number;
}> {
  if (
    typeof ticket !== 'string' ||
    ticket.length > MAX_TICKET_LENGTH ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(ticket)
  )
    throw invalidTicket();
  const [payload, signature] = ticket.split('.');
  const expected = createHmac('sha256', keyFor('ticket'))
    .update(payload)
    .digest();
  const received = Buffer.from(signature, 'base64url');
  const decoded = Buffer.from(payload, 'base64url');
  if (
    received.toString('base64url') !== signature ||
    decoded.toString('base64url') !== payload ||
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  )
    throw invalidTicket();
  let permit: GenerationTicket;
  try {
    permit = JSON.parse(decoded.toString('utf8'));
  } catch {
    throw invalidTicket();
  }
  if (
    !permit ||
    permit.v !== 1 ||
    permit.purpose !== PURPOSE ||
    typeof permit.id !== 'string' ||
    !isVideoId(permit.id) ||
    !validPlan(permit.plan) ||
    typeof permit.direction !== 'string' ||
    permit.direction.length > 4000 ||
    !Number.isSafeInteger(permit.expires) ||
    permit.expires <= Date.now() ||
    permit.expires > Date.now() + LIFETIME + 30_000
  )
    throw invalidTicket();
  return {
    id: permit.id,
    plan: permit.plan,
    direction: permit.direction,
    expires: permit.expires,
  };
}

function objectKey(id: string, kind: RecordKind) {
  if (typeof id !== 'string' || !isVideoId(id)) throw invalidTicket();
  requireStorage();
  keyFor('record');
  return `jobs/${id}/${kind}`;
}

function storageError() {
  return new RequestError(
    'Generation storage is temporarily unavailable. Please retry this video in a moment.',
    503,
  );
}

async function blobMetadata(key: string) {
  try {
    const metadata = await head(key, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
      abortSignal: AbortSignal.timeout(5_000),
    });
    const url = new URL(metadata.url);
    if (
      metadata.pathname !== key ||
      url.protocol !== 'https:' ||
      !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i.test(url.hostname) ||
      url.pathname !== `/${key}` ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      metadata.contentType !== 'application/octet-stream' ||
      !Number.isSafeInteger(metadata.size) ||
      metadata.size < 1 ||
      metadata.size > MAX_RECORD_BYTES
    )
      throw storageError();
    return metadata;
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw storageError();
  }
}

async function exists(key: string): Promise<boolean> {
  if (storageMode() === 'blob') return Boolean(await blobMetadata(key));
  let file;
  try {
    file = await open(path.join(localDataDirectory(), key), 'r');
    return (await file.stat()).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw storageError();
  } finally {
    await file?.close();
  }
}

// Never retry the provider submission after an ambiguous claim write. A lost
// process may leave a pending claim, but cannot cause a second paid request.
async function createImmutable(key: string, bytes: Buffer): Promise<boolean> {
  if (storageMode() === 'blob') {
    try {
      await put(key, bytes, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'application/octet-stream',
        cacheControlMaxAge: 31536000,
        abortSignal: AbortSignal.timeout(5_000),
      });
      return true;
    } catch {
      if (await exists(key)) return false;
      throw storageError();
    }
  }
  const target = path.join(localDataDirectory(), key);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await link(temporary, target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw storageError();
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

async function readObject(key: string): Promise<Buffer | null> {
  if (storageMode() === 'blob') {
    const metadata = await blobMetadata(key);
    if (!metadata) return null;
    try {
      const response = await fetch(metadata.url, {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) throw storageError();
      const bytes = await readLimited(response, MAX_RECORD_BYTES);
      if (bytes.length !== metadata.size) throw storageError();
      return Buffer.from(bytes);
    } catch {
      throw storageError();
    }
  }
  let file;
  try {
    file = await open(path.join(localDataDirectory(), key), 'r');
    const buffer = Buffer.alloc(MAX_RECORD_BYTES + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead < 1 || bytesRead > MAX_RECORD_BYTES) throw storageError();
    return buffer.subarray(0, bytesRead);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw storageError();
  } finally {
    await file?.close();
  }
}

function validResult(value: unknown): value is GenerationResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as GenerationResult;
  return (
    (typeof result.providerId === 'string' &&
      result.providerId.length > 0 &&
      result.providerId.length <= 512 &&
      result.error === undefined) ||
    (typeof result.error === 'string' &&
      result.error.length > 0 &&
      result.error.length <= 2000 &&
      result.providerId === undefined)
  );
}

function encrypt(id: string, result: GenerationResult): Buffer {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor('record'), nonce);
  cipher.setAAD(Buffer.from(`${PURPOSE}:result:v1:${id}`));
  const clear = Buffer.from(JSON.stringify(result));
  const encrypted = Buffer.concat([cipher.update(clear), cipher.final()]);
  return Buffer.concat([
    Buffer.from([1]),
    nonce,
    cipher.getAuthTag(),
    encrypted,
  ]);
}

function decrypt(id: string, bytes: Buffer): GenerationResult {
  try {
    if (bytes[0] !== 1 || bytes.length < 30) throw storageError();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      keyFor('record'),
      bytes.subarray(1, 13),
    );
    decipher.setAAD(Buffer.from(`${PURPOSE}:result:v1:${id}`));
    decipher.setAuthTag(bytes.subarray(13, 29));
    const clear = Buffer.concat([
      decipher.update(bytes.subarray(29)),
      decipher.final(),
    ]);
    const result: unknown = JSON.parse(clear.toString('utf8'));
    if (!validResult(result)) throw storageError();
    return result;
  } catch {
    throw storageError();
  }
}

export async function claimGeneration(id: string): Promise<boolean> {
  return createImmutable(objectKey(id, 'claim'), Buffer.from('claimed'));
}

export async function recordGeneration(
  id: string,
  result: GenerationResult,
): Promise<void> {
  const key = objectKey(id, 'result');
  if (!validResult(result))
    throw new RequestError('Invalid generation result.');
  // Only the minimal provider result is stored; the full brief stays in its ticket.
  const record: GenerationResult = result.providerId
    ? { providerId: result.providerId }
    : { error: result.error };
  if (!(await exists(objectKey(id, 'claim'))))
    throw new RequestError('This generation has not been started.', 409);
  if (await createImmutable(key, encrypt(id, record))) return;
  const existing = await readObject(key);
  if (existing) {
    const saved = decrypt(id, existing);
    if (saved.providerId === record.providerId && saved.error === record.error)
      return;
  }
  throw new RequestError(
    'This generation already has a different result.',
    409,
  );
}

export async function readGeneration(
  id: string,
): Promise<{ claimed: boolean; providerId?: string; error?: string }> {
  const claimKey = objectKey(id, 'claim');
  const resultKey = objectKey(id, 'result');
  const [claimed, bytes] = await Promise.all([
    exists(claimKey),
    readObject(resultKey),
  ]);
  if (bytes && !claimed) throw storageError();
  return { claimed, ...(bytes ? decrypt(id, bytes) : {}) };
}
