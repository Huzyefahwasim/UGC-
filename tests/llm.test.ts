import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtime, RequestError } from '../lib/server.ts';
import { creativeCompletion } from '../lib/llm.ts';

void test('Gemini never uses stale OpenAI credentials, model or endpoint', () => {
  const settings = runtime({
    OPENAI_API_KEY: 'old-key',
    AI_MODEL: 'gpt-4.1-mini',
    AI_BASE_URL: 'https://example.com',
  });
  assert.equal(settings.provider, 'gemini');
  assert.equal(settings.apiKey, undefined);
  assert.equal(settings.model, 'gemini-3.8-flash');
  assert.equal(
    new URL(settings.endpoint).hostname,
    'generativelanguage.googleapis.com',
  );
  assert.equal(
    runtime({ GEMINI_API_KEY: ' new-key ', GEMINI_MODEL: 'custom-gemini' })
      .apiKey,
    'new-key',
  );
  assert.equal(
    runtime({ GEMINI_MODEL: 'custom-gemini' }).model,
    'custom-gemini',
  );
  assert.equal(
    runtime({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'old-key' }).apiKey,
    'old-key',
  );
  assert.throws(() => runtime({ AI_PROVIDER: 'typo' }), /AI_PROVIDER/);
});

void test('Gemini request carries conversation and directions to Google and parses JSON', async () => {
  const messages = [
    {
      role: 'system' as const,
      content: 'Return a JSON brief with product facts and shot direction.',
    },
    { role: 'user' as const, content: 'Hi' },
  ];
  let calls = 0;
  const result = await creativeCompletion(
    runtime({ GEMINI_API_KEY: 'test-secret' }),
    messages,
    async (url, init) => {
      calls++;
      assert.equal(
        url,
        'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      );
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer test-secret',
      );
      assert.equal(init?.redirect, 'error');
      const body = JSON.parse(init?.body as string);
      assert.deepEqual(body.messages, messages);
      assert.deepEqual(body.response_format, { type: 'json_object' });
      assert.equal(body.reasoning_effort, 'low');
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({ kind: 'chat', reply: 'Hello!' }),
            },
          },
        ],
      });
    },
  );
  assert.equal(calls, 1);
  assert.deepEqual(result, { kind: 'chat', reply: 'Hello!' });
});

void test('Quota and authentication errors are sanitized without retries or provider switching', async () => {
  for (const status of [429, 401, 403, 500]) {
    let calls = 0;
    await assert.rejects(
      creativeCompletion(
        runtime({ GEMINI_API_KEY: 'test-secret' }),
        [],
        async () => {
          calls++;
          return new Response('private upstream details', { status });
        },
      ),
      (error: unknown) =>
        error instanceof RequestError &&
        error.status === (status === 429 ? 429 : 503) &&
        !error.message.includes('private'),
    );
    assert.equal(calls, 1);
  }
});

void test('Incomplete, blocked and malformed briefs never trigger a render', async () => {
  for (const [finish_reason, content] of [
    ['length', '{"kind":"render","reply":"unfinished"}'],
    ['content_filter', ''],
    ['stop', 'not JSON'],
    ['stop', 'null'],
    ['stop', '{"kind":"unknown","reply":"bad"}'],
  ]) {
    await assert.rejects(
      creativeCompletion(
        runtime({ GEMINI_API_KEY: 'test-secret' }),
        [],
        async () =>
          Response.json({ choices: [{ finish_reason, message: { content } }] }),
      ),
      /completely/,
    );
  }
});

