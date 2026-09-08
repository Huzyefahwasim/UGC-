import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRenderTicket, verifyRenderTicket } from '../lib/tickets.ts';
import {
  MAX_VIDEO_BYTES,
  findVideo,
  parseByteRange,
  requireStorage,
  saveVideo,
  storageMode,
  validateVideo,
  videoResponse,
} from '../lib/storage.ts';
import { readLimited, RequestError, rateLimit } from '../lib/server.ts';

function sampleVideo(type: 'mp4' | 'webm', size = 12000) {
  const bytes = Buffer.alloc(size, 17);
  if (type === 'mp4') bytes.write('ftyp', 4, 'ascii');
  else bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
  return bytes;
}
const status = (code: number) => (error: unknown) =>
  error instanceof RequestError && error.status === code;

void test('video backend: durable tickets, bounded uploads and reusable public responses', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cut-backend-'));
  const keys = [
    'CUT_DATA_DIR',
    'BLOB_READ_WRITE_TOKEN',
    'RENDER_SIGNING_SECRET',
    'NODE_ENV',
    'VERCEL',
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, { CUT_DATA_DIR: directory, NODE_ENV: 'test' });
  t.after(async () => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: previous[key] });
    }
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('cut-backend-'));
    await rm(resolved, { recursive: true, force: true });
  });

  await t.test(
    'concurrent ticket creation shares a persisted key and requires a valid signature',
    async () => {
      const tickets = await Promise.all(
        Array.from({ length: 8 }, () => createRenderTicket('Notes app')),
      );
      const permits = await Promise.all(tickets.map(verifyRenderTicket));
      assert.equal(new Set(permits.map((permit) => permit.id)).size, 8);
      assert.ok(permits.every((permit) => permit.product === 'Notes app'));
      assert.equal(
        (await readFile(path.join(directory, 'render-signing-key'))).length,
        32,
      );
      const [payload, signature] = tickets[0].split('.');
      const changed = JSON.parse(Buffer.from(payload, 'base64url').toString());
      changed.id = randomUUID();
      await assert.rejects(
        verifyRenderTicket(
          `${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}`,
        ),
        status(403),
      );
      await assert.rejects(
        verifyRenderTicket(`${payload}.${signature.slice(0, 3)}`),
        status(403),
      );
      const alphabet =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      const alternateLast = alphabet[alphabet.indexOf(signature.at(-1)!) + 1];
      await assert.rejects(
        verifyRenderTicket(
          `${payload}.${signature.slice(0, -1)}${alternateLast}`,
        ),
        status(403),
      );
      await assert.rejects(verifyRenderTicket('x'.repeat(2049)), status(403));
      assert.deepEqual(await readdir(directory), ['render-signing-key']);
    },
  );

  await t.test(
    'tickets expire after fifteen minutes and survive independent verification calls',
    async (st) => {
      const now = Date.now();
      const clock = st.mock.method(Date, 'now', () => now - 16 * 60 * 1000);
      const expired = await createRenderTicket('Old product');
      clock.mock.restore();
      await assert.rejects(verifyRenderTicket(expired), status(403));
      const valid = await createRenderTicket('New product');
      assert.deepEqual(
        await verifyRenderTicket(valid),
        await verifyRenderTicket(valid),
      );
    },
  );

  await t.test(
    'a render can be saved only once, even when two formats race',
    async () => {
      const permit = await verifyRenderTicket(await createRenderTicket('Demo'));
      const results = await Promise.allSettled([
        saveVideo(permit.id, sampleVideo('mp4'), 'video/mp4'),
        saveVideo(permit.id, sampleVideo('webm'), 'video/webm'),
      ]);
      assert.equal(
        results.filter((result) => result.status === 'fulfilled').length,
        1,
      );
      const failed = results.find((result) => result.status === 'rejected');
      assert.ok(failed?.status === 'rejected' && status(409)(failed.reason));
      const stored = await findVideo(permit.id);
      assert.ok(stored?.kind === 'local');
      assert.equal(stored.bytes.length, 12000);
      assert.deepEqual(await readdir(path.join(directory, 'videos')), [
        permit.id,
      ]);
      await assert.rejects(
        saveVideo(permit.id, sampleVideo('mp4'), 'video/mp4'),
        status(409),
      );
    },
  );

  await t.test(
    'uploads reject bad types, bad signatures and bodies above four million bytes',
    async () => {
      assert.equal(validateVideo(sampleVideo('mp4'), 'video/mp4'), 'video/mp4');
      assert.equal(
        validateVideo(sampleVideo('webm'), 'video/webm'),
        'video/webm',
      );
      assert.throws(
        () => validateVideo(sampleVideo('webm'), 'video/mp4'),
        status(400),
      );
      assert.throws(
        () => validateVideo(sampleVideo('mp4'), 'text/html'),
        status(400),
      );
      assert.throws(
        () =>
          validateVideo(sampleVideo('mp4', MAX_VIDEO_BYTES + 1), 'video/mp4'),
        status(413),
      );
      assert.throws(
        () => validateVideo(sampleVideo('mp4', 20), 'video/mp4'),
        status(400),
      );
      await assert.rejects(
        readLimited(new Response(Buffer.alloc(101)), 100),
        status(413),
      );
      assert.equal(await findVideo('../render-signing-key'), null);
      await assert.rejects(
        saveVideo('../outside', sampleVideo('mp4'), 'video/mp4'),
        status(403),
      );
    },
  );

  await t.test(
    'range parsing handles suffixes, end clamping and unsatisfiable requests',
    () => {
      assert.deepEqual(parseByteRange('bytes=10-19', 100), {
        start: 10,
        end: 19,
      });
      assert.deepEqual(parseByteRange('bytes=-10', 100), {
        start: 90,
        end: 99,
      });
      assert.deepEqual(parseByteRange('bytes=90-', 100), {
        start: 90,
        end: 99,
      });
      assert.deepEqual(parseByteRange('bytes=90-1000', 100), {
        start: 90,
        end: 99,
      });
      for (const range of [
        'bytes=100-',
        'bytes=20-10',
        'bytes=-0',
        'bytes=1-2,4-5',
        'bytes=-',
        'bytes=9007199254740992-',
      ])
        assert.equal(parseByteRange(range, 100), 'invalid', range);
    },
  );

  await t.test(
    'local playback, ranges, HEAD, ETags and attachment names are correct',
    async () => {
      const id = randomUUID();
      const bytes = sampleVideo('mp4');
      await saveVideo(id, bytes, 'video/mp4');
      const stored = await findVideo(id);
      assert.ok(stored);
      const url = `http://localhost/api/videos/${id}`;
      const full = await videoResponse(new Request(url), id, stored);
      assert.equal(full.status, 200);
      assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
      const partial = await videoResponse(
        new Request(url, { headers: { Range: 'bytes=4-7' } }),
        id,
        stored,
      );
      assert.equal(partial.status, 206);
      assert.equal(partial.headers.get('Content-Range'), 'bytes 4-7/12000');
      assert.equal(await partial.text(), 'ftyp');
      const head = await videoResponse(
        new Request(`${url}?download=1`, { method: 'HEAD' }),
        id,
        stored,
      );
      assert.equal(head.headers.get('Content-Length'), '12000');
      assert.equal(
        head.headers.get('Content-Disposition'),
        `attachment; filename="cut-${id}.mp4"`,
      );
      assert.equal(await head.text(), '');
      const invalid = await videoResponse(
        new Request(url, { headers: { Range: 'bytes=99999-' } }),
        id,
        stored,
      );
      assert.equal(invalid.status, 416);
      assert.equal(invalid.headers.get('Content-Range'), 'bytes */12000');
      const unchanged = await videoResponse(
        new Request(url, { headers: { 'If-None-Match': stored.etag } }),
        id,
        stored,
      );
      assert.equal(unchanged.status, 304);
      const staleRange = await videoResponse(
        new Request(url, {
          headers: { Range: 'bytes=4-7', 'If-Range': 'old-etag' },
        }),
        id,
        stored,
      );
      assert.equal(staleRange.status, 200);
    },
  );

  await t.test(
    'public Blob playback redirects to CDN and downloads retain video extension',
    async (st) => {
      const id = randomUUID();
      const bytes = sampleVideo('webm');
      const object = {
        kind: 'blob' as const,
        type: 'video/webm' as const,
        url: 'https://example.invalid/video',
        downloadUrl: 'https://example.invalid/video?download=1',
        size: bytes.length,
        etag: '"test"',
      };
      const mockedFetch = st.mock.method(
        globalThis,
        'fetch',
        async () => new Response(bytes),
      );
      const playback = await videoResponse(
        new Request(`http://localhost/api/videos/${id}`),
        id,
        object,
      );
      assert.equal(playback.status, 307);
      assert.equal(playback.headers.get('Location'), object.url);
      assert.equal(mockedFetch.mock.callCount(), 0);
      const download = await videoResponse(
        new Request(`http://localhost/api/videos/${id}?download=1`),
        id,
        object,
      );
      assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
      assert.equal(
        download.headers.get('Content-Disposition'),
        `attachment; filename="cut-${id}.webm"`,
      );
      assert.equal(mockedFetch.mock.callCount(), 1);
    },
  );

  await t.test(
    'production refuses ephemeral disk storage and uses token-derived signatures',
    async () => {
      Object.assign(process.env, { NODE_ENV: 'production', VERCEL: '1' });
      assert.equal(storageMode(), 'unavailable');
      assert.throws(requireStorage, status(503));
      await assert.rejects(createRenderTicket('No store'), status(503));
      process.env.BLOB_READ_WRITE_TOKEN =
        'unit-test-token-not-a-real-service-credential';
      assert.equal(storageMode(), 'blob');
      const signed = await createRenderTicket('Configured store');
      assert.equal(
        (await verifyRenderTicket(signed)).product,
        'Configured store',
      );
      process.env.BLOB_READ_WRITE_TOKEN = 'different-test-token';
      await assert.rejects(verifyRenderTicket(signed), status(403));
      delete process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.VERCEL;
      Object.assign(process.env, { NODE_ENV: 'test' });
    },
  );

  await t.test(
    'the bounded per-process chat backstop rejects the twenty-first request',
    async () => {
      const request = new Request('http://localhost/api/chat');
      for (let i = 0; i < 20; i++) await rateLimit(request);
      await assert.rejects(rateLimit(request), status(429));
    },
  );
});
