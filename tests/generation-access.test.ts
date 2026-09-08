import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkGenerationAccess,
  generationAccessRequired,
} from '../lib/generation-access.ts';

await test('paid generation access gate separates local development from public deployments', () => {
  const prior = {
    code: process.env.STUDIO_ACCESS_CODE,
    node: process.env.NODE_ENV,
    vercel: process.env.VERCEL,
  };
  const request = (code = '') =>
    new Request('http://localhost/api/generations', {
      headers: { 'x-studio-access': code },
    });
  try {
    delete process.env.STUDIO_ACCESS_CODE;
    delete process.env.VERCEL;
    (process.env as Record<string, string | undefined>).NODE_ENV =
      'development';
    assert.equal(generationAccessRequired(), false);
    assert.doesNotThrow(() => checkGenerationAccess(request()));
    process.env.VERCEL = '1';
    assert.equal(generationAccessRequired(), true);
    assert.throws(() => checkGenerationAccess(request()), { status: 503 });
    process.env.STUDIO_ACCESS_CODE = 'test-studio-code-not-a-real-secret';
    assert.throws(() => checkGenerationAccess(request()), { status: 401 });
    assert.throws(() => checkGenerationAccess(request('wrong')), {
      status: 401,
    });
    assert.throws(() => checkGenerationAccess(request('x'.repeat(301))), {
      status: 401,
    });
    assert.doesNotThrow(() =>
      checkGenerationAccess(request('test-studio-code-not-a-real-secret')),
    );
    delete process.env.VERCEL;
    (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
    assert.equal(generationAccessRequired(), true);
    delete process.env.STUDIO_ACCESS_CODE;
    assert.throws(() => checkGenerationAccess(request()), { status: 503 });
  } finally {
    for (const [name, value] of Object.entries({
      STUDIO_ACCESS_CODE: prior.code,
      NODE_ENV: prior.node,
      VERCEL: prior.vercel,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
