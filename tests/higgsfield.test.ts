import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cancelVideo,
  configured,
  getVideoStatus,
  submitVideo,
} from '../lib/higgsfield.ts';
import { RequestError } from '../lib/server.ts';
import type { VideoPlan } from '../lib/types.ts';

const ID = '6d3b9db3-5a71-4058-a2e6-0e4932ac23f7';
const OTHER_ID = '68401730-6c95-47e1-b7d7-5f1c62ea32d9';
const plan: VideoPlan = {
  product: 'Bloom',
  description: 'A plant-care app with watering reminders.',
  url: 'https://bloom.company/',
  category: 'general',
  captions: [
    'Happy plants start here.',
    'Watering reminders that fit your routine.',
    'Explore Bloom.',
  ],
  background: '/photo.jpg',
  gif: '/sticker.gif',
  audio: '/audio.mp3',
  accent: '#ffffff',
  credits: [],
};
const status = (code: number) => (error: unknown) =>
  error instanceof RequestError && error.status === code;

void test('Higgsfield provider follows the documented async API without making real generations', async (t) => {
  const keys = [
    'HF_CREDENTIALS',
    'HF_API_KEY_ID',
    'HF_API_KEY_SECRET',
  ] as const;
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  for (const key of keys) delete process.env[key];
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  await t.test(
    'missing or incomplete credentials never make a network request',
    async (st) => {
      const fetch = st.mock.method(globalThis, 'fetch', async () => {
        throw new Error('Unexpected network request');
      });
      assert.equal(configured(), false);
      await assert.rejects(submitVideo(plan), status(503));
      process.env.HF_API_KEY_ID = 'test-key';
      assert.equal(configured(), false);
      process.env.HF_CREDENTIALS = 'combined-key:combined-secret';
      assert.equal(configured(), false);
      process.env.HF_API_KEY_SECRET = 'bad\nsecret';
      assert.equal(configured(), false);
      assert.equal(fetch.mock.callCount(), 0);
      delete process.env.HF_CREDENTIALS;
    },
  );
  process.env.HF_API_KEY_SECRET = 'test-secret';

  await t.test(
    'submits eight-second portrait video with native audio and no automatic retry',
    async (st) => {
      assert.equal(configured(), true);
      const fetch = st.mock.method(
        globalThis,
        'fetch',
        async (_input: string | URL | Request, _init?: RequestInit) =>
          Response.json({ status: 'queued', request_id: ID }),
      );
      const result = await submitVideo(
        plan,
        'Warm daylight and a quick match cut.',
      );
      assert.deepEqual(result, { id: ID });
      assert.equal(fetch.mock.callCount(), 1);
      const [url, options] = fetch.mock.calls[0].arguments;
      assert.equal(url, 'https://api.higgsfield.ai/veo3.1/fast');
      assert.equal(options?.method, 'POST');
      assert.equal(options?.redirect, 'error');
      assert.equal(options?.cache, 'no-store');
      assert.equal(
        new Headers(options?.headers).get('Authorization'),
        'Key test-key:test-secret',
      );
      assert.equal(typeof options?.body, 'string');
      const body = JSON.parse(options?.body as string);
      assert.equal(body.duration, '8');
      assert.equal(body.resolution, '720');
      assert.equal(body.aspect_ratio, '9:16');
      assert.equal(body.generate_audio, true);
      assert.match(body.prompt, /Watering reminders/);
      assert.match(body.prompt, /Warm daylight and a quick match cut/);
      assert.match(body.prompt, /Do not fabricate reviews/);
      assert.doesNotMatch(body.prompt, /test-secret/);
    },
  );

  await t.test(
    'creative input is bounded and only explicit key-pair credentials are used',
    async (st) => {
      process.env.HF_CREDENTIALS = 'combined-key:combined-secret';
      const fetch = st.mock.method(
        globalThis,
        'fetch',
        async (_input: string | URL | Request, _init?: RequestInit) =>
          Response.json({ status: 'queued', request_id: ID }),
      );
      await submitVideo(
        { ...plan, description: 'a'.repeat(30000) },
        'b'.repeat(30000),
      );
      const options = fetch.mock.calls[0].arguments[1];
      assert.equal(
        new Headers(options?.headers).get('Authorization'),
        'Key test-key:test-secret',
      );
      assert.ok(options && typeof options.body === 'string');
      assert.ok(options.body.length < 6500);
      delete process.env.HF_CREDENTIALS;
    },
  );

  await t.test('validates job IDs before contacting a provider', async (st) => {
    const fetch = st.mock.method(globalThis, 'fetch', async () => {
      throw new Error('Unexpected network request');
    });
    for (const id of [
      '../keys',
      'https://attacker.com',
      ID + '?x=1',
      '6d3b9db3-5a71-1058-a2e6-0e4932ac23f7',
    ]) {
      await assert.rejects(getVideoStatus(id), status(400));
      await assert.rejects(cancelVideo(id), status(400));
    }
    assert.equal(fetch.mock.callCount(), 0);
  });

  await t.test(
    'reads each lifecycle status and never exposes upstream errors',
    async (st) => {
      const fetch = st.mock.method(
        globalThis,
        'fetch',
        async (_input: string | URL | Request, _init?: RequestInit) =>
          Response.json({ status: 'queued', request_id: ID }),
      );
      for (const [providerStatus, expected] of [
        ['queued', 'queued'],
        ['in_progress', 'in_progress'],
        ['failed', 'failed'],
        ['nsfw', 'nsfw'],
        ['canceled', 'cancelled'],
      ]) {
        fetch.mock.mockImplementation(async () =>
          Response.json({
            status: providerStatus,
            request_id: ID,
            error: 'test-secret raw private details',
          }),
        );
        const result = await getVideoStatus(ID);
        assert.equal(result.status, expected);
        assert.doesNotMatch(
          JSON.stringify(result),
          /test-secret|raw private details/,
        );
      }
      const [url, options] = fetch.mock.calls[0].arguments;
      assert.equal(url, `https://api.higgsfield.ai/requests/${ID}/status`);
      assert.equal(options?.method, 'GET');
    },
  );

  await t.test(
    'completed video returns its CDN URL without fetching the video or trusting status links',
    async (st) => {
      const url =
        'https://media.higgsfield.ai/videos/generated.mp4?signature=public-token';
      const fetch = st.mock.method(globalThis, 'fetch', async () =>
        Response.json({
          status: 'completed',
          request_id: ID,
          video: { url },
          status_url: 'https://attacker.com/status',
          cancel_url: 'https://attacker.com/cancel',
        }),
      );
      assert.deepEqual(await getVideoStatus(ID), { status: 'completed', url });
      assert.equal(fetch.mock.callCount(), 1);
    },
  );

  await t.test(
    'rejects malformed output and private or non-HTTPS media URLs',
    async (st) => {
      const fetch = st.mock.method(globalThis, 'fetch', async () =>
        Response.json({ status: 'completed', request_id: ID, video: {} }),
      );
      for (const url of [
        'http://media.higgsfield.ai/video.mp4',
        'https://localhost/v.mp4',
        'https://127.0.0.1/v.mp4',
        'https://[::1]/v.mp4',
        'https://10.0.0.1/v.mp4',
        'https://service.internal/v.mp4',
        'https://user:secret@cdn.higgsfield.ai/v.mp4',
        'https://cdn.higgsfield.ai:8443/v.mp4',
        'javascript:alert(1)',
        'https://cdn.higgsfield.ai/v.mp4#fragment',
      ]) {
        fetch.mock.mockImplementation(async () =>
          Response.json({
            status: 'completed',
            request_id: ID,
            video: { url },
          }),
        );
        await assert.rejects(getVideoStatus(ID), status(502));
      }
      fetch.mock.mockImplementation(async () =>
        Response.json({ status: 'completed', request_id: ID, video: {} }),
      );
      await assert.rejects(getVideoStatus(ID), status(502));
    },
  );

  await t.test(
    'rejects unknown states and responses for another job',
    async (st) => {
      const fetch = st.mock.method(globalThis, 'fetch', async () =>
        Response.json({ status: 'queued', request_id: OTHER_ID }),
      );
      await assert.rejects(getVideoStatus(ID), status(502));
      fetch.mock.mockImplementation(async () =>
        Response.json({ status: 'mysterious', request_id: ID }),
      );
      await assert.rejects(getVideoStatus(ID), status(502));
      fetch.mock.mockImplementation(async () =>
        Response.json({ status: 'queued', request_id: 'not-an-id' }),
      );
      await assert.rejects(submitVideo(plan), status(502));
    },
  );

  await t.test(
    'network failures are safe and paid submissions are not retried',
    async (st) => {
      const fetch = st.mock.method(globalThis, 'fetch', async () => {
        throw new Error('Secret test-secret from an upstream exception');
      });
      await assert.rejects(submitVideo(plan), (error: unknown) => {
        assert.ok(error instanceof RequestError);
        assert.equal(error.status, 502);
        assert.match(error.message, /may still be running/);
        assert.doesNotMatch(error.message, /test-secret/);
        return true;
      });
      assert.equal(fetch.mock.callCount(), 1);
    },
  );

  await t.test(
    'provider HTTP errors are translated without exposing response text',
    async (st) => {
      const fetch = st.mock.method(
        globalThis,
        'fetch',
        async () => new Response('test-secret', { status: 401 }),
      );
      for (const [providerStatus, expected] of [
        [401, 503],
        [402, 503],
        [403, 503],
        [429, 429],
        [404, 503],
        [422, 400],
        [500, 502],
      ]) {
        fetch.mock.mockImplementation(
          async () =>
            new Response('test-secret raw stack', { status: providerStatus }),
        );
        await assert.rejects(submitVideo(plan), (error: unknown) => {
          assert.ok(error instanceof RequestError);
          assert.equal(error.status, expected);
          assert.doesNotMatch(error.message, /test-secret|raw stack/);
          return true;
        });
      }
    },
  );

  await t.test(
    'response bodies are bounded and malformed JSON does not leak',
    async (st) => {
      const fetch = st.mock.method(
        globalThis,
        'fetch',
        async () => new Response('x'.repeat(65537)),
      );
      await assert.rejects(getVideoStatus(ID), status(502));
      fetch.mock.mockImplementation(
        async () => new Response('{"secret":"test-secret"'),
      );
      await assert.rejects(getVideoStatus(ID), status(502));
      fetch.mock.mockImplementation(async () => {
        throw new DOMException('Secret test-secret', 'TimeoutError');
      });
      await assert.rejects(getVideoStatus(ID), status(504));
    },
  );

  await t.test(
    'queued cancellation accepts 202 without trying to parse JSON',
    async (st) => {
      const fetch = st.mock.method(
        globalThis,
        'fetch',
        async (_input: string | URL | Request, _init?: RequestInit) =>
          new Response(null, { status: 202 }),
      );
      await cancelVideo(ID);
      assert.equal(fetch.mock.callCount(), 1);
      const [url, options] = fetch.mock.calls[0].arguments;
      assert.equal(url, `https://api.higgsfield.ai/requests/${ID}/cancel`);
      assert.equal(options?.method, 'POST');
      assert.equal(options?.body, undefined);
    },
  );

  await t.test(
    'cancellation after processing started explains the conflict',
    async (st) => {
      st.mock.method(
        globalThis,
        'fetch',
        async () => new Response('already started', { status: 400 }),
      );
      await assert.rejects(cancelVideo(ID), (error: unknown) => {
        assert.ok(error instanceof RequestError);
        assert.equal(error.status, 409);
        assert.match(error.message, /already started/);
        return true;
      });
    },
  );
});
