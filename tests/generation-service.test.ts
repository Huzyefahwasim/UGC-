import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startGeneration } from '../lib/generation-service.ts';
import { RequestError } from '../lib/server.ts';
import type { VideoPlan } from '../lib/types.ts';

const ID = '166cf24e-5d88-4a61-969e-8051647a2c74';
const PROVIDER_ID = 'f081f050-0393-4362-9205-a56a91d754f5';
const plan: VideoPlan = {
  product: 'Bloom',
  url: 'https://bloom.company/',
  description: 'Plant watering reminders.',
  category: 'general',
  captions: ['Happy plants.', 'Reminders that help.', 'Explore Bloom.'],
  background: '',
  gif: '',
  audio: '',
  accent: '#ffffff',
  credits: [],
};
const ticket = { id: ID, plan, direction: 'Natural daylight.' };

function fixture() {
  let claimed = false;
  let submitted = 0;
  let authorized = 0;
  const records: { providerId?: string; error?: string }[] = [];
  const dependencies = {
    read: async (_id: string) => ({ claimed }),
    claim: async (_id: string) => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    record: async (
      _id: string,
      result: { providerId?: string; error?: string },
    ) => {
      records.push(result);
    },
    submit: async (_plan: VideoPlan, _direction: string) => {
      submitted++;
      return { id: PROVIDER_ID };
    },
  };
  return {
    dependencies,
    authorize: () => {
      authorized++;
    },
    state: () => ({ claimed, submitted, authorized, records }),
  };
}

void test('generation start service never repeats a GPU submission', async (t) => {
  await t.test(
    'a duplicate claim returns the same job without authorization or resubmission',
    async () => {
      const f = fixture();
      assert.deepEqual(
        await startGeneration(ticket, f.authorize, f.dependencies),
        { id: ID },
      );
      assert.deepEqual(
        await startGeneration(
          ticket,
          () => {
            throw new Error('Must not ask again');
          },
          f.dependencies,
        ),
        { id: ID },
      );
      assert.deepEqual(f.state(), {
        claimed: true,
        submitted: 1,
        authorized: 1,
        records: [{ providerId: PROVIDER_ID }],
      });
    },
  );

  await t.test(
    'concurrent starts only submit the winning atomic claim',
    async () => {
      const f = fixture();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          startGeneration(ticket, f.authorize, f.dependencies),
        ),
      );
      assert.ok(results.every((result) => result.id === ID));
      assert.equal(f.state().submitted, 1);
      assert.equal(f.state().records.length, 1);
    },
  );

  await t.test(
    'authorization rejection does not create a claim or submit',
    async () => {
      const f = fixture();
      await assert.rejects(
        startGeneration(
          ticket,
          () => {
            throw new RequestError('Access required.', 401);
          },
          f.dependencies,
        ),
        (error: unknown) =>
          error instanceof RequestError && error.status === 401,
      );
      assert.equal(f.state().claimed, false);
      assert.equal(f.state().submitted, 0);
    },
  );

  await t.test(
    'persistence failures retry only the same known provider ID',
    async () => {
      const f = fixture();
      const attempts: { providerId?: string; error?: string }[] = [];
      f.dependencies.record = async (_id, result) => {
        attempts.push({ ...result });
        if (attempts.length < 3) throw new Error('Temporary storage outage');
      };
      await startGeneration(ticket, f.authorize, f.dependencies);
      assert.equal(f.state().submitted, 1);
      assert.deepEqual(attempts, Array(3).fill({ providerId: PROVIDER_ID }));
      assert.equal(f.state().claimed, true);
    },
  );

  await t.test(
    'persistent result-store failure retains claim and reports the provider recovery ID',
    async () => {
      const f = fixture();
      const attempts: { providerId?: string; error?: string }[] = [];
      f.dependencies.record = async (_id, result) => {
        attempts.push({ ...result });
        throw new Error('Secret database connection details');
      };
      await assert.rejects(
        startGeneration(ticket, f.authorize, f.dependencies),
        (error: unknown) => {
          assert.ok(error instanceof RequestError);
          assert.equal(error.status, 503);
          assert.match(error.message, /finished the footage/);
          assert.doesNotMatch(error.message, /Secret database/);
          return true;
        },
      );
      assert.equal(f.state().submitted, 1);
      assert.equal(f.state().claimed, true);
      assert.deepEqual(attempts, Array(3).fill({ providerId: PROVIDER_ID }));
      await startGeneration(ticket, f.authorize, f.dependencies);
      assert.equal(f.state().submitted, 1);
      assert.equal(attempts.length, 3);
    },
  );

  await t.test(
    'definite provider rejections preserve safe credential, credit and input reasons',
    async () => {
      for (const [message, status] of [
        ['LTX credentials need attention.', 503],
        ['LTX needs free GPU allowance.', 503],
        ['LTX could not accept this brief.', 400],
        ['LTX is at its generation limit.', 429],
      ] as const) {
        const f = fixture();
        let calls = 0;
        f.dependencies.submit = async () => {
          calls++;
          throw new RequestError(message, status);
        };
        await startGeneration(ticket, f.authorize, f.dependencies);
        await startGeneration(ticket, f.authorize, f.dependencies);
        assert.equal(calls, 1);
        assert.deepEqual(f.state().records, [{ error: message }]);
        assert.equal(f.state().claimed, true);
      }
    },
  );

  await t.test(
    'ambiguous provider failures retain the claim without retry or raw error disclosure',
    async () => {
      const f = fixture();
      let calls = 0;
      f.dependencies.submit = async () => {
        calls++;
        throw new RequestError('upstream secret data', 504);
      };
      await startGeneration(ticket, f.authorize, f.dependencies);
      await startGeneration(ticket, f.authorize, f.dependencies);
      assert.equal(calls, 1);
      assert.match(f.state().records[0].error!, /No automatic retry/);
      assert.doesNotMatch(f.state().records[0].error!, /upstream secret/);
      assert.equal(f.state().claimed, true);
    },
  );

  await t.test(
    'failure to persist a rejected submission never removes its claim or repeats it',
    async () => {
      const f = fixture();
      let calls = 0;
      let saves = 0;
      f.dependencies.submit = async () => {
        calls++;
        throw new RequestError('LTX needs free GPU allowance.', 503);
      };
      f.dependencies.record = async () => {
        saves++;
        throw new Error('Storage unavailable');
      };
      await assert.rejects(
        startGeneration(ticket, f.authorize, f.dependencies),
        (error: unknown) => {
          assert.ok(error instanceof RequestError);
          assert.match(error.message, /needs free GPU allowance/);
          assert.match(error.message, /could not save/);
          return true;
        },
      );
      await startGeneration(ticket, f.authorize, f.dependencies);
      assert.equal(calls, 1);
      assert.equal(saves, 3);
      assert.equal(f.state().claimed, true);
    },
  );

  await t.test('ambiguous claim failure does not submit', async () => {
    const f = fixture();
    f.dependencies.claim = async () => {
      throw new Error('Claim response lost');
    };
    await assert.rejects(
      startGeneration(ticket, f.authorize, f.dependencies),
      /Claim response lost/,
    );
    assert.equal(f.state().submitted, 0);
    assert.equal(f.state().records.length, 0);
  });
});
