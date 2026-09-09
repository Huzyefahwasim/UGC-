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
  assert.equal(settings.model, 'gemini-3.6-flash');
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
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      );
      assert.equal(
        new Headers(init?.headers).get('x-goog-api-key'),
        'test-secret',
      );
      assert.equal(init?.redirect, 'error');
      const body = JSON.parse(init?.body as string);
      assert.deepEqual(body.systemInstruction.parts, [
        { text: messages[0].content },
      ]);
      assert.deepEqual(body.contents, [
        { role: 'user', parts: [{ text: 'Hi' }] },
      ]);
      assert.equal(body.generationConfig.responseMimeType, 'application/json');
      assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, 'low');
      return Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                { text: 'Do not show this', thought: true },
                { text: JSON.stringify({ kind: 'chat', reply: 'Hello!' }) },
              ],
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

void test('Native Gemini preserves prior assistant replies as model turns', async () => {
  const settings = runtime({ GEMINI_API_KEY: 'test-secret' });
  await creativeCompletion(
    settings,
    [
      { role: 'system', content: 'Instructions' },
      { role: 'user', content: 'My product is Bloom.' },
      { role: 'assistant', content: 'What does Bloom do?' },
      { role: 'user', content: 'Plant reminders.' },
    ],
    async (_url, init) => {
      const body = JSON.parse(init?.body as string);
      assert.deepEqual(
        body.contents.map((m: { role: string }) => m.role),
        ['user', 'model', 'user'],
      );
      assert.equal(body.contents[1].parts[0].text, 'What does Bloom do?');
      return Response.json({
        candidates: [
          {
            finishReason: 'STOP',
            content: { parts: [{ text: '{"kind":"chat","reply":"Thanks!"}' }] },
          },
        ],
      });
    },
  );
});

void test('Explicit legacy provider keeps the chat completions contract', async () => {
  await creativeCompletion(
    runtime({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'legacy-key' }),
    [{ role: 'user', content: 'Hi' }],
    async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      assert.equal(
        new Headers(init?.headers).get('Authorization'),
        'Bearer legacy-key',
      );
      assert.equal(new Headers(init?.headers).get('x-goog-api-key'), null);
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: { content: '{"kind":"chat","reply":"Hi!"}' },
          },
        ],
      });
    },
  );
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
          Response.json({
            candidates: [
              {
                finishReason: finish_reason.toUpperCase(),
                content: { parts: [{ text: content }] },
              },
            ],
          }),
      ),
      /completely/,
    );
  }
});

void test('OpenRouter uses the exact free model and its own credentials without paid routing', async () => {
  const settings = runtime({
    AI_PROVIDER: 'openrouter',
    OPENROUTER_API_KEY: 'router-test',
    GEMINI_API_KEY: 'wrong',
    AI_BASE_URL: 'https://wrong.example',
  });
  assert.equal(settings.endpoint, 'https://openrouter.ai/api/v1');
  assert.equal(settings.apiKey, 'router-test');
  assert.equal(
    runtime({ AI_PROVIDER: 'openrouter', GEMINI_API_KEY: 'wrong' }).apiKey,
    undefined,
  );
  assert.equal(
    runtime({
      UGC_AI_PROVIDER: 'openrouter',
      UGC_OPENROUTER_API_KEY: 'prefixed',
    }).apiKey,
    'prefixed',
  );
  const result = await creativeCompletion(
    settings,
    [{ role: 'user', content: 'hi' }],
    async (url, init) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      const body = JSON.parse(init!.body as string);
      assert.equal(body.model, 'nvidia/nemotron-3-ultra-550b-a55b:free');
      assert.equal(body.response_format, undefined);
      assert.deepEqual(body.provider, {
        allow_fallbacks: false,
        max_price: { prompt: 0, completion: 0, request: 0 },
      });
      return Response.json({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              content: JSON.stringify({ kind: 'chat', reply: 'Hello' }),
            },
          },
        ],
      });
    },
  );
  assert.deepEqual(result, { kind: 'chat', reply: 'Hello' });
});
