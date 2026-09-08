import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  claimGeneration,
  createGenerationTicket,
  readGeneration,
  recordGeneration,
  verifyGenerationTicket,
} from '../lib/generation-jobs.ts';
import { prepareGenerationRetry } from '../lib/generation-retry.ts';
import { RequestError } from '../lib/server.ts';
import { isVideoId } from '../lib/storage.ts';
import type { VideoPlan } from '../lib/types.ts';

const plan: VideoPlan = {
  product: 'Bloom',
  url: 'https://example.com/',
  description: 'Plant care reminders.',
  category: 'general',
  captions: ['A little plant care', 'Remember when to water', 'Try Bloom'],
  background: '/assets/background.jpg',
  gif: '/assets/party.gif',
  audio: '/assets/music.mp3',
  accent: '#ffffff',
  credits: [],
};
const direction = 'Slow overhead shot of watering a small potted plant.';
const hasStatus = (status: number) => (error: unknown) =>
  error instanceof RequestError && error.status === status;

void test('explicit failed generation retries', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cut-retry-'));
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
  Object.assign(process.env, {
    CUT_DATA_DIR: directory,
    NODE_ENV: 'test',
    RENDER_SIGNING_SECRET: 'unit-test-retry-secret',
  });
  t.after(async () => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else Object.assign(process.env, { [key]: previous[key] });
    }
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('cut-retry-'));
    await rm(resolved, { recursive: true, force: true });
  });
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Preparing a retry must not call any provider.');
  });

  const newParent = async () => {
    const ticket = await createGenerationTicket(plan, direction);
    const parent = await verifyGenerationTicket(ticket);
    return { ...parent, ticket };
  };

  await t.test(
    'unknown, active and completed parents cannot be retried',
    async () => {
      const parent = await newParent();
      await assert.rejects(
        prepareGenerationRetry(parent.id, parent.ticket, () => {}),
        hasStatus(409),
      );
      await claimGeneration(parent.id);
      await assert.rejects(
        prepareGenerationRetry(parent.id, parent.ticket, () => {}),
        hasStatus(409),
      );
      await recordGeneration(parent.id, { providerId: 'completed-footage' });
      await assert.rejects(
        prepareGenerationRetry(parent.id, parent.ticket, () => {}),
        hasStatus(409),
      );
    },
  );

  await t.test(
    'concurrent retries retain the exact brief and return one unclaimed child',
    async () => {
      const parent = await newParent();
      await claimGeneration(parent.id);
      await recordGeneration(parent.id, {
        error: 'The provider could not finish.',
      });
      let authorizations = 0;
      const children = await Promise.all(
        Array.from({ length: 12 }, () =>
          prepareGenerationRetry(parent.id, parent.ticket, () => {
            authorizations++;
          }),
        ),
      );
      assert.equal(authorizations, 12);
      assert.equal(new Set(children.map((child) => child.id)).size, 1);
      const child = children[0];
      assert.notEqual(child.id, parent.id);
      assert.ok(isVideoId(child.id));
      for (const result of children) {
        const decoded = await verifyGenerationTicket(result.ticket);
        assert.equal(decoded.id, child.id);
        assert.deepEqual(decoded.plan, parent.plan);
        assert.equal(decoded.direction, parent.direction);
      }
      assert.deepEqual(await readGeneration(child.id), { claimed: false });
      assert.equal(
        (await readdir(path.join(directory, 'jobs'))).includes(child.id),
        false,
      );

      // A lost retry response followed by completion must still target this child.
      await claimGeneration(child.id);
      await recordGeneration(child.id, {
        providerId: 'finished-child-footage',
      });
      const replay = await prepareGenerationRetry(
        parent.id,
        parent.ticket,
        () => {},
      );
      assert.equal(replay.id, child.id);
    },
  );

  await t.test(
    'every preparation needs authorization, including duplicate requests',
    async () => {
      const parent = await newParent();
      await claimGeneration(parent.id);
      await recordGeneration(parent.id, { error: 'Provider unavailable.' });
      await prepareGenerationRetry(parent.id, parent.ticket, () => {});
      await assert.rejects(
        prepareGenerationRetry(parent.id, parent.ticket, () => {
          throw new RequestError('Studio access required.', 401);
        }),
        hasStatus(401),
      );
    },
  );

  await t.test(
    'a child must fail durably before it can receive its own retry',
    async () => {
      const parent = await newParent();
      await claimGeneration(parent.id);
      await recordGeneration(parent.id, { error: 'Provider unavailable.' });
      const child = await prepareGenerationRetry(
        parent.id,
        parent.ticket,
        () => {},
      );
      await assert.rejects(
        prepareGenerationRetry(child.id, child.ticket, () => {}),
        hasStatus(409),
      );
      await claimGeneration(child.id);
      await recordGeneration(child.id, {
        error: 'Provider still unavailable.',
      });
      const next = await prepareGenerationRetry(
        child.id,
        child.ticket,
        () => {},
      );
      assert.notEqual(next.id, child.id);
      assert.notEqual(next.id, parent.id);
      assert.deepEqual((await verifyGenerationTicket(next.ticket)).plan, plan);
      assert.deepEqual(await readGeneration(next.id), { claimed: false });
    },
  );

  await t.test(
    'mismatched, tampered and expired tickets cannot issue another ticket',
    async (st) => {
      const parent = await newParent();
      let authorized = false;
      const authorize = () => {
        authorized = true;
      };
      await assert.rejects(
        prepareGenerationRetry(randomUUID(), parent.ticket, authorize),
        hasStatus(403),
      );
      const [payload, signature] = parent.ticket.split('.');
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
      data.plan.product = 'Different product';
      const modified = `${Buffer.from(JSON.stringify(data)).toString('base64url')}.${signature}`;
      await assert.rejects(
        prepareGenerationRetry(parent.id, modified, authorize),
        hasStatus(403),
      );
      const now = Date.now();
      const clock = st.mock.method(
        Date,
        'now',
        () => now - 25 * 60 * 60 * 1000,
      );
      const expired = await createGenerationTicket(plan, direction, parent.id);
      clock.mock.restore();
      await assert.rejects(
        prepareGenerationRetry(parent.id, expired, authorize),
        hasStatus(403),
      );
      assert.equal(authorized, false);
    },
  );

  await t.test(
    'ticket creators reject non-UUID child identifiers',
    async () => {
      for (const id of ['../outside', randomUUID().toUpperCase(), 'invalid'])
        await assert.rejects(
          createGenerationTicket(plan, direction, id),
          hasStatus(403),
        );
    },
  );
});
