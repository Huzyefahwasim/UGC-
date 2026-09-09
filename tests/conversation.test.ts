import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  fallbackReply,
  intentFor,
  suppliedProduct,
  type PreviousProduct,
} from '../lib/conversation.ts';

const website = {
  product: 'Bloom',
  description: 'A plant-care app',
  body: 'Care reminders for your plants.',
};
const previous: PreviousProduct = {
  product: 'CalAI',
  description: 'A calorie-tracking app',
  url: 'https://calai.app/',
  category: 'food',
  captions: ['Original hook', 'Original benefit', 'Original CTA'],
};

void test('explicit video requests render even when phrased as questions or containing query strings', () => {
  for (const message of [
    'Can you make a video for https://bloom.app?',
    'Could you create an ad for https://bloom.app/plants?ref=chat&mode=demo?',
    'Generate a promo for bloom.app?ref=chat',
  ]) {
    assert.equal(intentFor(message), 'render', message);
    const reply = fallbackReply(message, website);
    assert.equal(reply.kind, 'render', message);
    assert.equal(reply.product, 'Bloom');
    assert.equal(reply.description, website.description);
  }
});

void test('greetings, help and thanks remain conversation even with a previous product', () => {
  for (const message of [
    'hi',
    'Hey there!',
    'What can you do?',
    'How does this work?',
    'Thanks!',
    'Love it',
  ]) {
    assert.equal(intentFor(message, true), 'chat', message);
    const reply = fallbackReply(message, undefined, previous);
    assert.equal(reply.kind, 'chat', message);
    assert.ok(reply.reply.trim(), message);
    assert.equal(reply.captions, undefined, message);
  }
});

void test('advisory and capability questions do not render the linked product', () => {
  for (const message of [
    'Can you explain what I should focus on when building https://bloom.app?',
    'What do you think of https://bloom.app?',
    'How can I improve my app at https://bloom.app?',
    'Tell me how you would market https://bloom.app',
    'Can you explain how you create a video for https://bloom.app?',
  ]) {
    assert.equal(intentFor(message, true), 'chat', message);
    assert.equal(
      fallbackReply(message, website, previous).kind,
      'chat',
      message,
    );
  }
});

void test('explicit requests not to make a video take precedence over a product link', () => {
  for (const message of [
    "I don't want a video for https://bloom.app",
    'Don’t create a video for https://bloom.app',
    'Do not render https://bloom.app',
    "I'm building Bloom, a plant-care app. Please don't make a video yet.",
  ]) {
    assert.equal(intentFor(message, true), 'chat', message);
    assert.equal(
      fallbackReply(message, website, previous).kind,
      'chat',
      message,
    );
  }
});

void test('product introductions without a website supply a usable rendering brief', () => {
  for (const message of [
    "I'm building Bloom, a plant-care app.",
    'Bloom is a plant-care app',
    'My app is Bloom, a plant-care app',
    'Our product is Bloom, a plant-care app',
  ]) {
    assert.deepEqual(
      suppliedProduct(message),
      {
        product: 'Bloom',
        description: 'a plant-care app',
      },
      message,
    );
    assert.equal(intentFor(message), 'render', message);
    const reply = fallbackReply(message, undefined, previous);
    assert.equal(reply.kind, 'render', message);
    assert.equal(reply.product, 'Bloom', message);
    assert.equal(reply.description, 'a plant-care app', message);
    assert.equal(reply.category, 'general', message);
  }
});

void test('user-supplied product facts remain usable when the website cannot be read', () => {
  const reply = fallbackReply(
    "I'm building Bloom, a plant-care app. https://bloom.app",
    undefined,
    undefined,
    'The website could not be read.',
  );
  assert.equal(reply.kind, 'render');
  assert.equal(reply.product, 'Bloom');
  assert.equal(reply.description, 'a plant-care app');
  assert.equal(
    fallbackReply('https://bloom.app', undefined, undefined, 'Unavailable')
      .kind,
    'chat',
  );
});

void test('an exact quoted hook revision preserves the product and both other caption beats', () => {
  for (const message of [
    'Change the hook to "A fresh new hook"',
    'Change the hook to “A fresh new hook”',
  ]) {
    const original = structuredClone(previous);
    assert.equal(intentFor(message, true), 'revise', message);
    const reply = fallbackReply(message, undefined, original);
    assert.equal(reply.kind, 'render');
    assert.equal(reply.product, previous.product);
    assert.equal(reply.description, previous.description);
    assert.equal(reply.category, previous.category);
    assert.deepEqual(reply.captions, [
      'A fresh new hook',
      'Original benefit',
      'Original CTA',
    ]);
    assert.deepEqual(
      original,
      previous,
      'Revising must not mutate the previous video plan',
    );
  }
});

void test('a revision without a previous product asks for context instead of inventing a render', () => {
  assert.equal(fallbackReply('Make the hook punchier').kind, 'chat');
});

void test('a readable product link has enough context to render without asking for a description', () => {
  const reply = fallbackReply('cherrytreesolution.com', {
    product: 'Cherry Tree Solutions',
    description: 'Accounting and AI automation for businesses',
    body: 'Audit ready books, call answering and lead follow-up.',
  });
  assert.equal(reply.kind, 'render');
  assert.match(reply.description || '', /Accounting/);
  assert.equal(fallbackReply('hi').kind, 'chat');
  assert.equal(fallbackReply('what can you do?').kind, 'chat');
});
