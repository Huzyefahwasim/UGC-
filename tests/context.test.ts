import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contextualCaptions,
  fallbackReply,
  intentFor,
  revisionCaptions,
  type PreviousProduct,
} from '../lib/conversation.ts';
import { makePlan } from '../lib/product.ts';
import {
  directShot,
  shotForRequest,
  videoPrompt,
} from '../lib/video-direction.ts';
import {
  chooseReaction,
  reactionById,
  soundtrackForReaction,
} from '../lib/reactions.ts';

void test('meditation has a breathing context, matching reaction and music instead of generic hype', () => {
  const plan = makePlan(
    'Headspace',
    'https://headspace.com/',
    'Guided meditation and mindfulness for everyday life.',
    'general',
  );
  const shot = directShot(plan);
  assert.match(shot.action, /breath|eyes/);
  assert.doesNotMatch(shot.action, /laptop|workout|party/);
  assert.match(shot.camera, /quiet|gentle|almost still/i);
  const reaction = chooseReaction(
    `${plan.product} ${plan.description}`,
    plan.category,
    'mind-blown',
  );
  assert.equal(reaction, 'calm');
  assert.equal(reactionById(reaction).emoji, '😌');
  assert.equal(soundtrackForReaction(reaction).audio, '/assets/relax-beat.mp3');
  const captions = contextualCaptions(plan.product, plan.description);
  assert.match(captions[0], /head/);
  assert.equal(captions[1], plan.description.slice(0, -1));
  assert.doesNotMatch(
    captions.join(' '),
    /free|cure|guarantee|discount|download now/i,
  );
  assert.ok(videoPrompt({ ...plan, shot }).split(/\s+/).length <= 200);
});

void test('education and sleep choose different real use moments from the same broad category', () => {
  const learning = makePlan(
    'FSchoolAI',
    '',
    'An academic study companion for university students.',
    'general',
  );
  const bedtime = makePlan(
    'Nightfall',
    '',
    'Sleep stories and bedtime audio.',
    'general',
  );
  const studentShot = directShot(learning);
  const sleepShot = directShot(bedtime);
  assert.match(studentShot.action, /adult student|notebook/i);
  assert.match(studentShot.subject, /out of view/);
  assert.match(sleepShot.setting, /bedroom/);
  assert.match(sleepShot.lighting, /bedside lamp/);
  assert.notEqual(
    contextualCaptions(learning.product, learning.description)[0],
    contextualCaptions(bedtime.product, bedtime.description)[0],
  );
});

void test('caption-only and reaction-only revisions retain the established scene and unrequested captions', () => {
  const plan = makePlan(
    'Headspace',
    'https://headspace.com/',
    'A guided meditation app.',
    'general',
  );
  const previous: PreviousProduct = {
    ...plan,
    shot: directShot(plan),
    reaction: 'calm',
  };
  const proposedShot = directShot(
    makePlan('Coffee', '', 'Coffee delivery.', 'food'),
  );
  for (const message of [
    'Change the hook to "Take a little breathing break"',
    'Use a leaf emoji',
  ]) {
    assert.equal(intentFor(message, true), 'revise');
    const reply = fallbackReply(message, undefined, previous);
    assert.deepEqual(reply.shot, previous.shot);
    assert.equal(
      reply.reaction,
      message.includes('leaf') ? 'leaf' : previous.reaction,
    );
    if (message.includes('leaf'))
      assert.deepEqual(reply.captions, previous.captions);
    assert.deepEqual(
      shotForRequest(
        { ...plan, shot: proposedShot },
        message,
        '',
        previous.shot,
      ),
      previous.shot,
    );
  }
  const original = [
    'Original hook',
    'A supported benefit',
    'Explore Headspace.',
  ];
  assert.deepEqual(
    revisionCaptions(
      original,
      ['AI hook', 'Unrelated benefit', 'Try it free'],
      'Change the hook to "Take a little breathing break"',
    ),
    ['Take a little breathing break', original[1], original[2]],
  );
  assert.deepEqual(
    revisionCaptions(
      original,
      ['Changed hook', 'Changed benefit', 'Changed CTA'],
      'Use a leaf emoji',
    ),
    original,
  );
});

void test('fallback emoji requests select the requested replacement and respect a calm product context', () => {
  const previous: PreviousProduct = {
    product: 'Bloom',
    description: 'A plant-care app.',
    url: '',
    reaction: 'party',
    captions: [
      'Your plants are calling.',
      'Plant-care reminders.',
      'Explore Bloom.',
    ],
  };
  for (const request of [
    'Use a leaf emoji instead of party',
    'Change the reaction to 🌱',
    'Replace the party emoji with a leaf',
  ]) {
    const reply = fallbackReply(request, undefined, previous);
    assert.equal(reply.reaction, 'leaf', request);
    assert.deepEqual(reply.captions, previous.captions, request);
  }
  assert.equal(
    fallbackReply('Use a party emoji', undefined, {
      ...previous,
      product: 'Headspace',
      description: 'Guided meditation.',
    }).reaction,
    'calm',
  );
  assert.equal(
    fallbackReply('Do not use a leaf emoji', undefined, previous).reaction,
    'party',
  );
});

void test('a camera-only revision preserves the subject, location, action and lighting', () => {
  const plan = makePlan('Bloom', '', 'Plant-care reminders.', 'general');
  const previous = directShot(plan);
  const unrelated = directShot(
    makePlan('Nightfall', '', 'Sleep stories.', 'general'),
    'macro',
  );
  const changed = shotForRequest(
    { ...plan, shot: unrelated },
    'Use a close-up camera angle',
    '',
    previous,
  );
  assert.equal(changed.camera, unrelated.camera);
  for (const field of ['action', 'subject', 'setting', 'lighting'] as const)
    assert.equal(changed[field], previous[field]);
});

void test('greetings and questions about reactions remain conversation', () => {
  const previous: PreviousProduct = {
    product: 'Bloom',
    description: 'Plant care.',
    url: '',
  };
  for (const message of [
    'hi',
    'What can you do?',
    'Can you explain how you choose the emoji?',
    'How can I make the video calmer?',
  ]) {
    assert.equal(intentFor(message, true), 'chat');
    assert.equal(fallbackReply(message, undefined, previous).kind, 'chat');
  }
});

void test('deterministic captions use supplied facts, readable lengths and a neutral CTA', () => {
  const description =
    'A calendar tool for organizing appointments with a simple shared schedule';
  const captions = contextualCaptions('Daybook', description);
  assert.equal(captions[1], description);
  assert.equal(captions[2], 'Explore Daybook.');
  assert.ok(captions.every((caption) => caption.length <= 75));
  assert.doesNotMatch(
    captions.join(' '),
    /free|discount|guarantee|save \d|download now/i,
  );
});
