import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import {
  getGenerationQuota,
  requireGenerationQuota,
} from '../lib/generation-quota.ts';
import { GET } from '../app/api/generation-quota/route.ts';
import { RequestError } from '../lib/server.ts';

const QUOTA_URL = 'https://huggingface.co/api/spaces/zero-gpu/quota';
const SECRET = 'hf_quotaTestSecret';
const RESET = '2026-09-09T16:16:21.907Z';
const valid = (current = 300) => ({ base: 300, current, resetsAt: RESET });

function env(t: TestContext, key: string, value?: string) {
  const previous = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  t.after(() => {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  });
}

function respond(t: TestContext, body: unknown) {
  env(t, 'HUGGINGFACE_TOKEN', SECRET);
  return t.mock.method(globalThis, 'fetch', async () => Response.json(body));
}

void test('quota uses only a bounded authenticated GET and returns no provider extras', async (t) => {
  env(t, 'HUGGINGFACE_TOKEN', ` ${SECRET} `);
  const calls: { url: string; init?: RequestInit }[] = [];
  const timeout = t.mock.method(
    AbortSignal,
    'timeout',
    () => new AbortController().signal,
  );
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return Response.json({ ...valid(), secret: SECRET, overquotaUsed: 50 });
    },
  );
  const result = await getGenerationQuota();
  assert.deepEqual(result, {
    known: true,
    available: true,
    remainingSeconds: 300,
    requiredSeconds: 120,
    resetAt: RESET,
    reason: null,
  });
  assert.equal(timeout.mock.calls[0].arguments[0], 6000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, QUOTA_URL);
  assert.equal(calls[0].init?.method, 'GET');
  assert.equal(calls[0].init?.cache, 'no-store');
  assert.equal(calls[0].init?.redirect, 'error');
  assert.equal(calls[0].init?.body, undefined);
  assert.deepEqual(calls[0].init?.headers, {
    Authorization: `Bearer ${SECRET}`,
  });
  assert.doesNotMatch(JSON.stringify(result), /Secret|overquota|hf_/);
});

void test('reservation rejects fractional remainder below 120 seconds but accepts exactly 120', async (t) => {
  for (const [current, available] of [
    [119.999, false],
    [120, true],
  ] as const) {
    await t.test(String(current), async (sub) => {
      respond(sub, valid(current));
      const quota = await getGenerationQuota();
      assert.ok(quota.known);
      assert.equal(quota.available, available);
      assert.equal(quota.reason, available ? null : 'gpu');
      assert.equal(quota.remainingSeconds, current);
    });
  }
});

void test('a depleted runs limit blocks despite enough GPU seconds', async (t) => {
  const runsReset = '2026-09-09T18:00:00.000Z';
  respond(t, {
    ...valid(),
    runs: { used: 8, limit: 8, remaining: 0, resetsAt: runsReset },
  });
  const quota = await getGenerationQuota();
  assert.ok(quota.known);
  assert.equal(quota.available, false);
  assert.equal(quota.reason, 'runs');
  assert.equal(quota.resetAt, runsReset);
});

void test('independent exhausted limits use the later reset and never invent an unknown one', async (t) => {
  for (const runsReset of ['2026-09-10T18:00:00.000Z', null]) {
    await t.test(String(runsReset), async (sub) => {
      respond(sub, {
        ...valid(0),
        runs: { used: 8, limit: 8, remaining: 0, resetsAt: runsReset },
      });
      const quota = await getGenerationQuota();
      assert.ok(quota.known);
      assert.equal(quota.available, false);
      assert.equal(quota.resetAt, runsReset);
    });
  }
});

void test('missing, invalid or partial quota data stays unknown', async (t) => {
  for (const [index, body] of [
    null,
    {},
    { base: 300, resetsAt: RESET },
    { ...valid(), current: '0' },
    { ...valid(), resetsAt: 'tomorrow' },
    { ...valid(), resetsAt: undefined },
    { ...valid(), runs: {} },
    {
      ...valid(),
      runs: { used: 8, limit: 8, remaining: '0', resetsAt: RESET },
    },
  ].entries()) {
    await t.test(String(index), async (sub) => {
      respond(sub, body);
      assert.deepEqual(await getGenerationQuota(), { known: false });
      await assert.doesNotReject(requireGenerationQuota());
    });
  }
});

void test('failed HTTP, invalid JSON, oversized bodies and network errors are optional and private', async (t) => {
  const responses = [
    () => new Response(SECRET, { status: 401 }),
    () => new Response(SECRET, { status: 503 }),
    () => new Response(`not-json ${SECRET}`),
    () => new Response('x'.repeat(16 * 1024 + 1)),
    () => {
      throw new Error(SECRET);
    },
  ];
  for (const [index, response] of responses.entries()) {
    await t.test(String(index), async (sub) => {
      env(sub, 'HUGGINGFACE_TOKEN', SECRET);
      sub.mock.method(globalThis, 'fetch', async () => response());
      assert.deepEqual(await getGenerationQuota(), { known: false });
      await assert.doesNotReject(requireGenerationQuota());
    });
  }
});

void test('anonymous or malformed token skips quota requests', async (t) => {
  for (const token of [undefined, '', 'invalid-secret']) {
    await t.test(String(token), async (sub) => {
      env(sub, 'HUGGINGFACE_TOKEN', token);
      const request = sub.mock.method(globalThis, 'fetch', async () => {
        throw new Error('must not request');
      });
      assert.deepEqual(await getGenerationQuota(), { known: false });
      await assert.doesNotReject(requireGenerationQuota());
      assert.equal(request.mock.callCount(), 0);
    });
  }
});

void test('quota rejection reports a safe UTC reset without requesting generation or paid overflow', async (t) => {
  env(t, 'HUGGINGFACE_TOKEN', SECRET);
  const calls: string[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL, init?: RequestInit) => {
      calls.push(String(input));
      assert.equal(String(input), QUOTA_URL);
      assert.equal(init?.method, 'GET');
      return Response.json({
        ...valid(118.182584),
        overquotaUsed: 100,
        creditsAvailable: true,
        error: SECRET,
      });
    },
  );
  await assert.rejects(requireGenerationQuota(), (error: unknown) => {
    assert.ok(error instanceof RequestError);
    assert.equal(error.status, 429);
    assert.match(error.message, /not enough free video allowance/);
    assert.match(error.message, /9 Sept, 16:16 UTC/);
    assert.match(error.message, /stock assets/);
    assert.doesNotMatch(error.message, /Secret|hf_|creditsAvailable/);
    return true;
  });
  assert.equal(calls.length, 1);
});

void test('quota snapshot is available without a studio code in production', async (t) => {
  env(t, 'NODE_ENV', 'production');
  env(t, 'STUDIO_ACCESS_CODE', 'obsolete-code');
  const upstream = respond(t, valid());
  const response = await GET(
    new Request('http://localhost/api/generation-quota'),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal((await response.json()).known, true);
  assert.equal(upstream.mock.callCount(), 1);
});
