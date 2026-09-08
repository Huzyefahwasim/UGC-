import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { getGlobalDispatcher, MockAgent, setGlobalDispatcher } from 'undici';
import {
  claimGeneration,
  createGenerationTicket,
  readGeneration,
  recordGeneration,
  verifyGenerationTicket,
} from '../lib/generation-jobs.ts';
import { RequestError } from '../lib/server.ts';
import type { VideoPlan } from '../lib/types.ts';

const plan: VideoPlan = {
  product: 'Bloom',
  url: 'https://example.com',
  description: 'A simple plant care app',
  category: 'general',
  captions: ['Your plants have a plus-one', 'Know when to water', 'Try Bloom'],
  background: '/assets/background.jpg',
  gif: '/assets/party.gif',
  audio: '/assets/music.mp3',
  accent: '#ec7859',
  credits: [{ label: 'Example', url: 'https://example.com' }],
};
const status = (code: number) => (error: unknown) =>
  error instanceof RequestError && error.status === code;

void test('generation tickets and durable submission records', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cut-generation-'));
  const keys = [
    'CUT_DATA_DIR',
    'BLOB_READ_WRITE_TOKEN',
    'RENDER_SIGNING_SECRET',
    'HF_API_KEY_SECRET',
    'NODE_ENV',
    'VERCEL',
    'VERCEL_BLOB_RETRIES',
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    CUT_DATA_DIR: directory,
    NODE_ENV: 'test',
    RENDER_SIGNING_SECRET: 'unit-test-generation-secret',
    VERCEL_BLOB_RETRIES: '0',
  });
  t.after(async () => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: previous[key] });
    }
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('cut-generation-'));
    await rm(resolved, { recursive: true, force: true });
  });

  await t.test(
    'signed tickets survive independent reads and retain the exact brief',
    async () => {
      const ticket = await createGenerationTicket(
        plan,
        'Handheld creator testimonial',
      );
      const first = await verifyGenerationTicket(ticket);
      const second = await verifyGenerationTicket(ticket);
      assert.deepEqual(first, second);
      assert.deepEqual(first.plan, plan);
      assert.equal(first.direction, 'Handheld creator testimonial');
      assert.ok(first.expires > Date.now() + 23 * 60 * 60 * 1000);
      assert.notEqual(
        (await verifyGenerationTicket(await createGenerationTicket(plan, '')))
          .id,
        first.id,
      );
      assert.deepEqual(await readdir(directory), []);
    },
  );

  await t.test(
    'ticket tampering, alternate encodings and another purpose are rejected',
    async () => {
      const ticket = await createGenerationTicket(plan, 'Natural light');
      const [payload, signature] = ticket.split('.');
      const original = JSON.parse(Buffer.from(payload, 'base64url').toString());
      const modified = {
        ...original,
        plan: { ...plan, product: 'Injected product' },
      };
      await assert.rejects(
        verifyGenerationTicket(
          `${Buffer.from(JSON.stringify(modified)).toString('base64url')}.${signature}`,
        ),
        status(403),
      );
      const alphabet =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      const alternateLast = alphabet[alphabet.indexOf(signature.at(-1)!) + 1];
      await assert.rejects(
        verifyGenerationTicket(
          `${payload}.${signature.slice(0, -1)}${alternateLast}`,
        ),
        status(403),
      );
      await assert.rejects(
        verifyGenerationTicket('x'.repeat(32_001)),
        status(403),
      );
      const key = createHmac('sha256', process.env.RENDER_SIGNING_SECRET!)
        .update('cut-higgsfield-generation:ticket:v1')
        .digest();
      for (const change of [
        { purpose: 'legacy-render' },
        { v: 2 },
        { id: '../outside' },
      ]) {
        const wrongPurpose = Buffer.from(
          JSON.stringify({ ...original, ...change }),
        ).toString('base64url');
        const signed = createHmac('sha256', key)
          .update(wrongPurpose)
          .digest('base64url');
        await assert.rejects(
          verifyGenerationTicket(`${wrongPurpose}.${signed}`),
          status(403),
        );
      }
    },
  );

  await t.test(
    'tickets expire after 24 hours and do not accept clocks too far ahead',
    async (st) => {
      const now = Date.now();
      const clock = st.mock.method(
        Date,
        'now',
        () => now - 25 * 60 * 60 * 1000,
      );
      const expired = await createGenerationTicket(plan, '');
      clock.mock.restore();
      await assert.rejects(verifyGenerationTicket(expired), status(403));
      const futureClock = st.mock.method(Date, 'now', () => now + 60_000);
      const future = await createGenerationTicket(plan, '');
      futureClock.mock.restore();
      await assert.rejects(verifyGenerationTicket(future), status(403));
    },
  );

  await t.test(
    'missing provider or explicit secret fails closed and Blob is not a signing fallback',
    async () => {
      delete process.env.RENDER_SIGNING_SECRET;
      process.env.BLOB_READ_WRITE_TOKEN =
        'vercel_blob_rw_unit-test-not-a-real-token';
      await assert.rejects(createGenerationTicket(plan, ''), status(503));
      await assert.rejects(claimGeneration(randomUUID()), status(503));
      delete process.env.BLOB_READ_WRITE_TOKEN;
      process.env.HF_API_KEY_SECRET = 'unit-test-provider-secret';
      const ticket = await createGenerationTicket(plan, '');
      assert.deepEqual((await verifyGenerationTicket(ticket)).plan, plan);
      process.env.RENDER_SIGNING_SECRET = 'unit-test-generation-secret';
      await assert.rejects(verifyGenerationTicket(ticket), status(403));
      delete process.env.HF_API_KEY_SECRET;
    },
  );

  await t.test(
    'concurrent claims permit exactly one submission and remain claimed on later retries',
    async () => {
      const id = randomUUID();
      assert.deepEqual(await readGeneration(id), { claimed: false });
      const results = await Promise.all(
        Array.from({ length: 24 }, () => claimGeneration(id)),
      );
      assert.equal(results.filter(Boolean).length, 1);
      assert.deepEqual(await readGeneration(id), { claimed: true });
      assert.equal(await claimGeneration(id), false);
      assert.deepEqual(await readdir(path.join(directory, 'jobs', id)), [
        'claim',
      ]);
      assert.equal(
        (await readFile(path.join(directory, 'jobs', id, 'claim'))).toString(),
        'claimed',
      );
    },
  );

  await t.test(
    'provider results are encrypted, immutable and safe to record again identically',
    async () => {
      const id = randomUUID();
      await claimGeneration(id);
      await recordGeneration(id, { providerId: 'private-provider-request-id' });
      assert.deepEqual(await readGeneration(id), {
        claimed: true,
        providerId: 'private-provider-request-id',
      });
      const stored = await readFile(path.join(directory, 'jobs', id, 'result'));
      assert.equal(stored.includes('private-provider-request-id'), false);
      assert.equal(stored.includes('Bloom'), false);
      assert.equal(stored.includes('providerId'), false);
      await recordGeneration(id, { providerId: 'private-provider-request-id' });
      await assert.rejects(
        recordGeneration(id, { error: 'Overwrite attempt' }),
        status(409),
      );
      assert.deepEqual(
        await readFile(path.join(directory, 'jobs', id, 'result')),
        stored,
      );
      await assert.rejects(
        recordGeneration(randomUUID(), { providerId: 'not-claimed' }),
        status(409),
      );
      await assert.rejects(
        recordGeneration(id, { providerId: 'x', error: 'Ambiguous' }),
        status(400),
      );
    },
  );

  await t.test(
    'error records are private and ciphertext cannot be swapped across jobs or tampered with',
    async () => {
      const source = randomUUID();
      const target = randomUUID();
      await Promise.all([claimGeneration(source), claimGeneration(target)]);
      await recordGeneration(source, { error: 'Private provider diagnostic' });
      const sourceFile = path.join(directory, 'jobs', source, 'result');
      const targetFile = path.join(directory, 'jobs', target, 'result');
      assert.deepEqual(await readGeneration(source), {
        claimed: true,
        error: 'Private provider diagnostic',
      });
      assert.equal(
        (await readFile(sourceFile)).includes('Private provider diagnostic'),
        false,
      );
      await copyFile(sourceFile, targetFile);
      await assert.rejects(readGeneration(target), status(503));
      const damaged = await readFile(sourceFile);
      damaged[damaged.length - 1] ^= 1;
      await writeFile(sourceFile, damaged);
      await assert.rejects(readGeneration(source), status(503));
    },
  );

  await t.test(
    'invalid identifiers never become paths and production refuses temporary disk',
    async () => {
      for (const id of [
        '../outside',
        randomUUID().toUpperCase(),
        'not-an-id',
      ]) {
        await assert.rejects(claimGeneration(id), status(403));
        await assert.rejects(readGeneration(id), status(403));
        await assert.rejects(
          recordGeneration(id, { error: 'No' }),
          status(403),
        );
      }
      Object.assign(process.env, { NODE_ENV: 'production', VERCEL: '1' });
      await assert.rejects(createGenerationTicket(plan, ''), status(503));
      await assert.rejects(claimGeneration(randomUUID()), status(503));
      await assert.rejects(readGeneration(randomUUID()), status(503));
      delete process.env.VERCEL;
      Object.assign(process.env, { NODE_ENV: 'test' });
    },
  );

  await t.test(
    'Blob records use atomic no-overwrite keys and store encrypted provider information only',
    async (st) => {
      const dispatcher = getGlobalDispatcher();
      const mockAgent = new MockAgent();
      mockAgent.disableNetConnect();
      setGlobalDispatcher(mockAgent);
      st.after(async () => {
        setGlobalDispatcher(dispatcher);
        delete process.env.BLOB_READ_WRITE_TOKEN;
        await mockAgent.close();
      });
      process.env.BLOB_READ_WRITE_TOKEN =
        'vercel_blob_rw_unit-test-not-a-real-token';
      const objects = new Map<string, Buffer>();
      const pool = mockAgent.get('https://vercel.com');
      let metadataUrlOverride: string | undefined;
      let metadataSizeOverride: number | undefined;
      let downloadOverride: Uint8Array | null = null;
      const metadata = (key: string) => ({
        pathname: key,
        url:
          metadataUrlOverride ||
          `https://unit.public.blob.vercel-storage.com/${key}`,
        downloadUrl: `https://unit.public.blob.vercel-storage.com/${key}?download=1`,
        size: metadataSizeOverride ?? objects.get(key)!.length,
        contentType: 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        etag: 'unit-test',
      });
      pool
        .intercept({ path: /\/api\/blob\/\?pathname=/, method: 'PUT' })
        .reply((options) => {
          const key = new URL(
            options.path,
            'https://vercel.com',
          ).searchParams.get('pathname')!;
          const headers = new Headers(options.headers as HeadersInit);
          assert.equal(headers.get('x-allow-overwrite'), '0');
          assert.equal(headers.get('x-add-random-suffix'), '0');
          if (objects.has(key))
            return {
              statusCode: 412,
              data: JSON.stringify({ error: { code: 'precondition_failed' } }),
            };
          objects.set(key, Buffer.from(options.body as Buffer));
          return { statusCode: 200, data: JSON.stringify(metadata(key)) };
        })
        .persist();
      pool
        .intercept({ path: /\/api\/blob\?url=/, method: 'GET' })
        .reply((options) => {
          const key = new URL(
            options.path,
            'https://vercel.com',
          ).searchParams.get('url')!;
          return objects.has(key)
            ? { statusCode: 200, data: JSON.stringify(metadata(key)) }
            : {
                statusCode: 404,
                data: JSON.stringify({ error: { code: 'not_found' } }),
              };
        })
        .persist();
      const downloads = st.mock.method(
        globalThis,
        'fetch',
        async (input: string | URL | Request, init?: RequestInit) => {
          const url = new URL(input instanceof Request ? input.url : input);
          assert.equal(
            url.origin,
            'https://unit.public.blob.vercel-storage.com',
          );
          assert.equal(init?.redirect, 'error');
          const bytes = objects.get(url.pathname.slice(1));
          assert.ok(bytes);
          return new Response(new Uint8Array(downloadOverride || bytes));
        },
      );
      const id = randomUUID();
      assert.deepEqual(await readGeneration(id), { claimed: false });
      const claimed = await Promise.all(
        Array.from({ length: 8 }, () => claimGeneration(id)),
      );
      assert.equal(claimed.filter(Boolean).length, 1);
      await recordGeneration(id, { providerId: 'secret-remote-request-id' });
      await recordGeneration(id, { providerId: 'secret-remote-request-id' });
      assert.deepEqual(await readGeneration(id), {
        claimed: true,
        providerId: 'secret-remote-request-id',
      });
      assert.equal(objects.size, 2);
      const encrypted = objects.get(`jobs/${id}/result`)!;
      assert.ok(encrypted.length > 29);
      assert.equal(encrypted.includes('secret-remote-request-id'), false);
      assert.equal(encrypted.includes('Bloom'), false);
      const priorDownloads = downloads.mock.callCount();
      for (const url of [
        'https://127.0.0.1/private',
        'https://unit.public.blob.vercel-storage.com/another-job',
        `https://unit.public.blob.vercel-storage.com/jobs/${id}/result?redirect=1`,
      ]) {
        metadataUrlOverride = url;
        await assert.rejects(readGeneration(id), status(503));
      }
      metadataUrlOverride = undefined;
      metadataSizeOverride = 8193;
      await assert.rejects(readGeneration(id), status(503));
      assert.equal(downloads.mock.callCount(), priorDownloads);
      metadataSizeOverride = undefined;
      downloadOverride = new Uint8Array(8193);
      await assert.rejects(readGeneration(id), status(503));
    },
  );
});
