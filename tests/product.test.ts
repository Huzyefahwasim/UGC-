import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import {
  extractUrl,
  safeUrl,
  publicAddress,
  metadata,
  makePlan,
  categories,
  categoryFor,
} from '../lib/product.ts';
import { parseGIF, decompressFrames } from 'gifuct-js';

test('notes and design do not become food through substrings like create or great', () => {
  assert.equal(
    categoryFor('Bear creates beautiful markdown notes. Great ideas.'),
    'productivity',
  );
  assert.equal(categoryFor('Create a drawing with your team'), 'productivity');
  assert.equal(categoryFor('A calorie-tracking app for meals'), 'food');
  assert.equal(categoryFor('A skincare serum'), 'beauty');
});
test('finds bare and full product links and strips sentence punctuation', () => {
  assert.equal(
    extractUrl("I'm building CalAI: calai.app."),
    'https://calai.app/',
  );
  assert.equal(
    extractUrl('Try https://example.com/product?ref=chat'),
    'https://example.com/product?ref=chat',
  );
  assert.equal(extractUrl('hi'), null);
});
test('rejects local networks, non-web schemes, credentials and custom ports', () => {
  for (const url of [
    'http://127.0.0.1',
    'http://localhost',
    'http://[::1]',
    'http://192.168.0.1',
    'http://service.internal',
    'http://user:pass@example.com',
    'https://example.com:8443',
    'file:///etc/passwd',
  ])
    assert.throws(() => safeUrl(url), url);
  assert.equal(safeUrl('https://calai.app').hostname, 'calai.app');
});
test('DNS addresses must be public', () => {
  for (const ip of [
    '10.0.0.1',
    '127.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
  ])
    assert.equal(publicAddress(ip), false, ip);
  assert.equal(publicAddress('93.184.215.14'), true);
});
test('reads metadata regardless of attribute order and removes executable text', () => {
  const product = metadata(
    '<title>Demo | Product</title><meta content="Track meals &amp; nutrition" name="description"><script>secret-script</script><p>Good meals</p>',
    'https://demo.app',
  );
  assert.equal(product.product, 'Demo');
  assert.equal(product.description, 'Track meals & nutrition');
  assert.ok(!product.body.includes('secret-script'));
});
test('every category creates three captions and references real local assets', () => {
  for (const category of categories) {
    const plan = makePlan(
      'Sample',
      'https://sample.app',
      'A helpful product.',
      category,
    );
    assert.equal(plan.captions.length, 3);
    for (const asset of [plan.background, plan.gif, plan.audio])
      assert.ok(fs.statSync(`public${asset}`).size > 1000, asset);
  }
});
test('reaction assets contain multiple different real GIF frames', () => {
  for (const name of ['mind-blown', 'heart-eyes', 'muscle', 'party']) {
    const data = fs.readFileSync(`public/assets/${name}.gif`);
    const parsed = parseGIF(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    );
    const frames = decompressFrames(parsed, true);
    assert.ok(frames.length > 10);
    assert.ok(
      frames.some(
        (f) => !Buffer.from(f.patch).equals(Buffer.from(frames[0].patch)),
      ),
    );
  }
});
