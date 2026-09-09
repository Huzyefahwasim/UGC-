import { setting } from './config.ts';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, link, unlink } from 'node:fs/promises';
import path from 'node:path';
import { BlobNotFoundError, head, put } from '@vercel/blob';
import { readLimited, RequestError } from './server.ts';

export const MAX_VIDEO_BYTES = 4_000_000;
export type VideoType = 'video/mp4' | 'video/webm';
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isVideoId = (id: string) => UUID.test(id);

export function storageMode(): 'blob' | 'local' | 'unavailable' {
  if (setting('BLOB_READ_WRITE_TOKEN')) return 'blob';
  return process.env.VERCEL || process.env.NODE_ENV === 'production'
    ? 'unavailable'
    : 'local';
}
export const storageConfigured = () => storageMode() !== 'unavailable';
export function requireStorage() {
  if (!storageConfigured())
    throw new RequestError(
      'Video storage is not connected yet. Please ask the site owner to connect Vercel Blob.',
      503,
    );
}
export const localDataDirectory = () =>
  // Local-only files are runtime data and must never be traced into a deployment.
  path.resolve(
    /* turbopackIgnore: true */ process.env.CUT_DATA_DIR ||
      path.join(process.cwd(), '.data'),
  );

export function validateVideo(
  bytes: Uint8Array,
  contentType: string,
): VideoType {
  if (bytes.byteLength > MAX_VIDEO_BYTES)
    throw new RequestError(
      'The video is too large. Please render it again.',
      413,
    );
  if (contentType !== 'video/mp4' && contentType !== 'video/webm')
    throw new RequestError('Unsupported video format.');
  const mp4 = Buffer.from(bytes.subarray(4, 8)).toString('ascii') === 'ftyp';
  const webm =
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3;
  if (bytes.length < 10_000 || !(contentType === 'video/mp4' ? mp4 : webm))
    throw new RequestError(
      'That video did not encode correctly. Please try again.',
    );
  return contentType;
}

type LocalVideo = {
  kind: 'local';
  bytes: Uint8Array;
  type: VideoType;
  etag: string;
  size: number;
};
type BlobVideo = {
  kind: 'blob';
  url: string;
  downloadUrl: string;
  type: VideoType;
  etag: string;
  size: number;
};
export type StoredVideo = LocalVideo | BlobVideo;
const replayError = () =>
  new RequestError(
    'This render was already saved. Start a new cut to make another video.',
    409,
  );

// Both encodings share one immutable key, so changing MIME type cannot replay a ticket.
export async function saveVideo(
  id: string,
  bytes: Uint8Array,
  contentType: string,
) {
  requireStorage();
  if (!isVideoId(id)) throw new RequestError('Invalid render.', 403);
  const type = validateVideo(bytes, contentType);
  if (storageMode() === 'blob') {
    try {
      await put(`videos/${id}`, Buffer.from(bytes), {
        token: setting('BLOB_READ_WRITE_TOKEN'),
        access: 'public',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: type,
        cacheControlMaxAge: 31536000,
      });
    } catch {
      // This read only classifies a failed atomic write; it is not the replay guard.
      const exists = await head(`videos/${id}`, {
        token: setting('BLOB_READ_WRITE_TOKEN'),
      }).catch(() => null);
      if (exists) throw replayError();
      throw new RequestError(
        'Could not save the video. Please try again in a moment.',
        503,
      );
    }
    return;
  }
  const directory = path.join(localDataDirectory(), 'videos');
  await mkdir(directory, { recursive: true });
  const metadata = Buffer.from(JSON.stringify({ type }));
  const length = Buffer.alloc(4);
  length.writeUInt32BE(metadata.length);
  const target = path.join(directory, id);
  const temporary = path.join(directory, `${id}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, Buffer.concat([length, metadata, bytes]), {
      flag: 'wx',
      mode: 0o600,
    });
    // link() publishes the complete file atomically and fails if the key already exists.
    await link(temporary, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw replayError();
    throw error;
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export async function findVideo(id: string): Promise<StoredVideo | null> {
  if (!isVideoId(id)) return null;
  requireStorage();
  if (storageMode() === 'blob') {
    try {
      const object = await head(`videos/${id}`, {
        token: setting('BLOB_READ_WRITE_TOKEN'),
      });
      if (
        object.contentType !== 'video/mp4' &&
        object.contentType !== 'video/webm'
      )
        return null;
      return {
        kind: 'blob',
        url: object.url,
        downloadUrl: object.downloadUrl,
        type: object.contentType,
        etag: object.etag,
        size: object.size,
      };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return null;
      throw new RequestError(
        'Video storage is temporarily unavailable. Please try again.',
        503,
      );
    }
  }
  let data: Buffer;
  try {
    data = await readFile(path.join(localDataDirectory(), 'videos', id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (data.length < 4 || data.length > MAX_VIDEO_BYTES + 1024) return null;
  const metadataLength = data.readUInt32BE();
  if (metadataLength > 1024 || metadataLength + 4 >= data.length) return null;
  const { type } = JSON.parse(
    data.subarray(4, 4 + metadataLength).toString('utf8'),
  );
  const bytes = data.subarray(4 + metadataLength);
  validateVideo(bytes, type);
  return {
    kind: 'local',
    bytes,
    type,
    etag: `"${createHash('sha256').update(bytes).digest('hex')}"`,
    size: bytes.length,
  };
}

export function parseByteRange(
  value: string | null,
  size: number,
): { start: number; end: number } | null | 'invalid' {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2]) || size < 1) return 'invalid';
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return 'invalid';
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= size ||
    end < start
  )
    return 'invalid';
  return { start, end: Math.min(end, size - 1) };
}

export async function videoResponse(
  request: Request,
  id: string,
  object: StoredVideo,
) {
  const download = new URL(request.url).searchParams.has('download');
  if (object.kind === 'blob' && !download)
    return Response.redirect(object.url, 307);
  const headers = new Headers({
    'Content-Type': object.type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: object.etag,
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  });
  if (download)
    headers.set(
      'Content-Disposition',
      `attachment; filename="cut-${id}.${object.type === 'video/mp4' ? 'mp4' : 'webm'}"`,
    );
  const ifRange = request.headers.get('if-range');
  const range = parseByteRange(
    ifRange && ifRange !== object.etag ? null : request.headers.get('range'),
    object.size,
  );
  if (range === 'invalid') {
    headers.set('Content-Range', `bytes */${object.size}`);
    return new Response(null, { status: 416, headers });
  }
  if (!range && request.headers.get('if-none-match') === object.etag)
    return new Response(null, { status: 304, headers });
  const start = range?.start ?? 0;
  const end = range?.end ?? object.size - 1;
  headers.set('Content-Length', String(end - start + 1));
  if (range)
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
  const status = range ? 206 : 200;
  if (request.method === 'HEAD') return new Response(null, { status, headers });
  let bytes: Uint8Array;
  if (object.kind === 'local') bytes = object.bytes;
  else {
    const response = await fetch(object.url, {
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new RequestError(
        'Could not download this video. Please try again.',
        503,
      );
    bytes = await readLimited(response, MAX_VIDEO_BYTES);
    if (bytes.length !== object.size)
      throw new RequestError(
        'The download was incomplete. Please try again.',
        503,
      );
  }
  return new Response(Buffer.from(bytes.subarray(start, end + 1)), {
    status,
    headers,
  });
}
