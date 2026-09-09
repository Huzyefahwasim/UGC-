import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { makePlan } from '../lib/product.ts';
import {
  prepareReference,
  submitVideo,
  getVideoStatus,
  motionPrompt,
  mediaUrl,
} from '../lib/wan.ts';
import {
  WAN_SPACE,
  WAN_REQUIRED_SECONDS,
  validWanReference,
} from '../lib/wan-config.ts';
import {
  getGenerationQuota,
  requireGenerationQuota,
} from '../lib/generation-quota.ts';
import { getVideoStatus as dispatchStatus } from '../lib/generation-provider.ts';
import { LTX_SPACE } from '../lib/ltx.ts';

const reference = {
  path: '/tmp/gradio/' + 'a'.repeat(64) + '/reference.jpg',
  source: 'upload' as const,
};
const plan = {
  ...makePlan(
    'Bloom',
    'https://example.com',
    'Plant care reminders',
    'general',
  ),
  engine: 'wan' as const,
  reference,
};
const url =
  WAN_SPACE + '/gradio_api/file=/tmp/gradio/' + 'b'.repeat(64) + '/clip.mp4';
function token(t: TestContext) {
  const previous = process.env.HUGGINGFACE_TOKEN;
  process.env.HUGGINGFACE_TOKEN = 'hf_testWanToken';
  t.after(() => {
    if (previous === undefined) delete process.env.HUGGINGFACE_TOKEN;
    else process.env.HUGGINGFACE_TOKEN = previous;
  });
}
void test('reference upload strips metadata, crops to the exact recipe and only uses the fixed provider', async (t) => {
  token(t);
  const input = await sharp({
    create: { width: 900, height: 600, channels: 3, background: '#345678' },
  })
    .png()
    .toBuffer();
  let calls = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async (target: string, init: RequestInit) => {
      calls++;
      assert.equal(target, `${WAN_SPACE}/gradio_api/upload`);
      assert.equal(init.method, 'POST');
      assert.equal(init.redirect, 'error');
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        'Bearer hf_testWanToken',
      );
      const file = (init.body as FormData).get('files') as File;
      assert.equal(file.name, 'reference.jpg');
      const metadata = await sharp(
        Buffer.from(await file.arrayBuffer()),
      ).metadata();
      assert.equal(metadata.format, 'jpeg');
      assert.equal(metadata.width, 480);
      assert.equal(metadata.height, 704);
      assert.equal(metadata.exif, undefined);
      return Response.json([reference.path]);
    },
  );
  assert.deepEqual(
    await prepareReference(
      plan,
      `data:image/png;base64,${input.toString('base64')}`,
    ),
    reference,
  );
  assert.equal(calls, 1);
});
void test('invalid images, traversal and forged upload locations never reach generation', async (t) => {
  token(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    throw new Error('No network expected');
  });
  await assert.rejects(
    prepareReference(
      plan,
      'data:image/jpeg;base64,' + Buffer.from('<svg/>').toString('base64'),
    ),
    /valid JPG/,
  );
  await assert.rejects(
    prepareReference({ ...plan, background: '/assets/../../.env' }),
    /attach a reference/i,
  );
  await assert.rejects(
    submitVideo({ ...plan, reference: undefined }),
    /reference photo/,
  );
  for (const candidate of [
    'https://evil.example/a.jpg',
    '/tmp/gradio/../reference.jpg',
    reference.path + '?key=secret',
  ])
    assert.equal(validWanReference({ ...reference, path: candidate }), false);
  assert.equal(calls, 0);
});
void test('Wan submits exactly one image-to-video request, holds one stream and persists a reusable result', async (t) => {
  token(t);
  const calls: string[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (target: string, init: RequestInit) => {
      calls.push(target);
      assert.equal(
        (init.headers as Record<string, string>).Authorization,
        'Bearer hf_testWanToken',
      );
      assert.equal(init.redirect, 'error');
      if (init.method === 'POST') {
        assert.equal(target, `${WAN_SPACE}/gradio_api/call/generate_video`);
        const data = JSON.parse(init.body as string).data;
        assert.equal(data.length, 9);
        assert.deepEqual(data[0], {
          path: reference.path,
          meta: { _type: 'gradio.FileData' },
        });
        assert.equal(data[2], 4);
        assert.equal(data[4], 5);
        assert.equal(data[5], 1);
        assert.equal(data[6], 1);
        return Response.json({ event_id: 'c'.repeat(32) });
      }
      assert.equal(
        target,
        `${WAN_SPACE}/gradio_api/call/generate_video/${'c'.repeat(32)}`,
      );
      return new Response(
        `event: complete\ndata: ${JSON.stringify([{ url }, 42])}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    },
  );
  const result = await submitVideo(plan);
  assert.equal((await getVideoStatus(result.id)).url, url);
  assert.equal((await dispatchStatus(result.id)).url, url);
  assert.equal(calls.length, 2);
});
void test('provider rejection is never retried and arbitrary exception text is not disclosed', async (t) => {
  token(t);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response('hf_secret upstream', { status: 429 });
  });
  await assert.rejects(
    submitVideo(plan),
    (e) =>
      e instanceof Error &&
      /allowance/.test(e.message) &&
      !/secret/.test(e.message),
  );
  assert.equal(calls, 1);
});
void test('media origins are restricted and old LTX results remain readable', async () => {
  for (const bad of [
    'https://evil.example/gradio_api/file=x.mp4',
    url + '?token=1',
    url.replace('https:', 'http:'),
    WAN_SPACE + '/other.mp4',
  ])
    assert.throws(() => mediaUrl(bad));
  const legacy = `${LTX_SPACE}/gradio_api/file=/tmp/a.mp4`;
  assert.equal(
    (await dispatchStatus('ltx:' + Buffer.from(legacy).toString('base64url')))
      .url,
    legacy,
  );
});
void test('reference motion instructions preserve pictured content and adapt calm/static direction', () => {
  const prompt = motionPrompt(
    { ...plan, description: 'A calm meditation app' },
    'Keep a static camera.',
  );
  assert.match(prompt, /reference image takes priority/);
  assert.match(prompt, /camera locked/);
  assert.match(prompt, /unhurried and reassuring/);
  assert.match(prompt, /Do not invent a person/);
});
void test('Wan reservation is 45 seconds while legacy LTX still needs 120', async (t) => {
  token(t);
  let current = 45;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      base: 300,
      current,
      resetsAt: null,
      runs: { used: 0, limit: 8, remaining: 8, resetsAt: null },
    }),
  );
  assert.equal(WAN_REQUIRED_SECONDS, 45);
  assert.equal(
    ((await getGenerationQuota(WAN_REQUIRED_SECONDS)) as { available: boolean })
      .available,
    true,
  );
  await assert.doesNotReject(requireGenerationQuota(WAN_REQUIRED_SECONDS));
  await assert.rejects(requireGenerationQuota(), /not enough/);
  current = 44.99;
  await assert.rejects(
    requireGenerationQuota(WAN_REQUIRED_SECONDS),
    /not enough/,
  );
});

void test('link-only briefs automatically prepare a valid scene for every product category', async (t) => {
  token(t);
  let calls = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async (target: string, init: RequestInit) => {
      calls++;
      assert.equal(target, WAN_SPACE + '/gradio_api/upload');
      const file = (init.body as FormData).get('files') as File;
      const metadata = await sharp(
        Buffer.from(await file.arrayBuffer()),
      ).metadata();
      assert.equal(metadata.width, 480);
      assert.equal(metadata.height, 704);
      return Response.json([reference.path]);
    },
  );
  for (const category of [
    'food',
    'fitness',
    'productivity',
    'beauty',
    'travel',
    'general',
  ] as const) {
    const brief = makePlan(
      'Example',
      'https://example.com',
      'A product to promote',
      category,
    );
    const prepared = await prepareReference(brief);
    assert.deepEqual(prepared, { path: reference.path, source: 'stock' });
  }
  assert.equal(calls, 6);
});
