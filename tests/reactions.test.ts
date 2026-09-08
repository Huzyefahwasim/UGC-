import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { parseGIF, decompressFrames } from 'gifuct-js';
import {
  chooseReaction,
  reactions,
  soundtrackForReaction,
} from '../lib/reactions.ts';
import { makePlan } from '../lib/product.ts';

void test('Product contexts select relevant reactions instead of a category-wide meme', () => {
  const examples = [
    ['Headspace meditation and mindfulness', 'calm'],
    ['Plant watering reminders', 'leaf'],
    ['A coffee subscription for espresso lovers', 'coffee'],
    ['Student learning with flashcards', 'thinking'],
    ['Organize tasks and notes', 'focus'],
    ['A skincare routine', 'sparkles'],
  ];
  for (const [context, expected] of examples)
    assert.equal(chooseReaction(context, 'general'), expected);
  assert.equal(
    chooseReaction('Meditation for stress relief', 'general', 'mind-blown'),
    'calm',
  );
  assert.equal(chooseReaction('A cycling workout', 'fitness'), 'muscle');
  assert.equal(
    chooseReaction(
      'A helpful product',
      'general',
      'https://untrusted.test/reaction.gif',
    ),
    'sparkles',
  );
});

void test('Calm briefs carry a calm soundtrack and accurate attribution', () => {
  const plan = makePlan(
    'Headspace',
    'https://headspace.com/',
    'Meditation and sleep',
    'general',
  );
  assert.equal(plan.reaction, 'calm');
  assert.equal(plan.gif, '/assets/calm.gif');
  assert.equal(plan.audio, '/assets/relax-beat.mp3');
  assert.ok(plan.credits.some((c) => c.label.includes('Relax Beat')));
  assert.ok(!plan.credits.some((c) => c.label.includes('Gimme')));
  assert.notEqual(soundtrackForReaction('muscle').audio, plan.audio);
});

void test('Every curated reaction has multiple real animated frames and a local soundtrack', () => {
  for (const reaction of reactions) {
    const data = fs.readFileSync(`public${reaction.gif}`);
    const parsed = parseGIF(
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    );
    const frames = decompressFrames(parsed, true);
    assert.ok(frames.length > 2, reaction.id);
    assert.ok(
      frames.some(
        (frame) =>
          !Buffer.from(frame.patch).equals(Buffer.from(frames[0].patch)),
      ),
      reaction.id,
    );
    assert.ok(
      fs.statSync(`public${soundtrackForReaction(reaction.id).audio}`).size >
        1000,
    );
  }
});
