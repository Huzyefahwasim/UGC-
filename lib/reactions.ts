import type { Category } from './types';

export const reactions = [
  {
    id: 'calm',
    emoji: '😌',
    label: 'A little breathing room',
    gif: '/assets/calm.gif',
    mood: 'calm',
  },
  {
    id: 'heart-eyes',
    emoji: '😍',
    label: 'Love at first try',
    gif: '/assets/heart-eyes.gif',
    mood: 'warm',
  },
  {
    id: 'muscle',
    emoji: '💪',
    label: 'You’ve got this',
    gif: '/assets/muscle.gif',
    mood: 'energetic',
  },
  {
    id: 'party',
    emoji: '🥳',
    label: 'Small wins, big feeling',
    gif: '/assets/party.gif',
    mood: 'energetic',
  },
  {
    id: 'mind-blown',
    emoji: '🤯',
    label: 'Wait, that’s possible?',
    gif: '/assets/mind-blown.gif',
    mood: 'energetic',
  },
  {
    id: 'sparkles',
    emoji: '✨',
    label: 'A little everyday magic',
    gif: '/assets/sparkles.gif',
    mood: 'warm',
  },
  {
    id: 'thinking',
    emoji: '🤔',
    label: 'Let it click',
    gif: '/assets/thinking.gif',
    mood: 'thoughtful',
  },
  {
    id: 'focus',
    emoji: '🎯',
    label: 'One thing at a time',
    gif: '/assets/focus.gif',
    mood: 'thoughtful',
  },
  {
    id: 'coffee',
    emoji: '☕',
    label: 'Your daily ritual',
    gif: '/assets/coffee.gif',
    mood: 'calm',
  },
  {
    id: 'leaf',
    emoji: '🌱',
    label: 'A little room to grow',
    gif: '/assets/leaf.gif',
    mood: 'calm',
  },
  {
    id: 'rocket',
    emoji: '🚀',
    label: 'Ready when you are',
    gif: '/assets/rocket.gif',
    mood: 'energetic',
  },
] as const;

export type ReactionId = (typeof reactions)[number]['id'];
export function validReaction(value: unknown): value is ReactionId {
  return reactions.some((reaction) => reaction.id === value);
}
export function reactionById(value: unknown) {
  return reactions.find((reaction) => reaction.id === value) || reactions[5];
}

export function soundtrackForReaction(value: unknown) {
  const mood = reactionById(value).mood;
  return mood === 'calm' || mood === 'thoughtful'
    ? {
        audio: '/assets/relax-beat.mp3',
        credit: {
          label: 'Relax Beat · Arulo / Mixkit',
          url: 'https://mixkit.co/free-stock-music/mood/calm/',
        },
      }
    : {
        audio: '/assets/gimme-that-groove.mp3',
        credit: {
          label: 'Gimme that Groove! · Michael Ramir C. / Mixkit',
          url: 'https://mixkit.co/free-stock-music/funk/',
        },
      };
}

const CALM_CONTEXT =
  /\b(?:meditat(?:e|ion|ing)|mindfulness|breathwork|sleep|insomnia|anxiety|stress relief|mental (?:health|wellness)|calming|relaxation)\b/i;
const GROWTH_CONTEXT =
  /\b(?:plants?|garden(?:ing)?|seedlings?|sustainab(?:le|ility)|eco-friendly)\b/i;
const COFFEE_CONTEXT =
  /\b(?:coffee|espresso|cappuccino|matcha|tea ritual|barista)\b/i;

export function chooseReaction(
  text: string,
  category: Category,
  preferred?: unknown,
): ReactionId {
  // A calm product should never inherit a shocked/celebration reaction from a broad category.
  if (CALM_CONTEXT.test(text)) {
    return preferred === 'leaf' || preferred === 'sparkles'
      ? preferred
      : 'calm';
  }
  if (validReaction(preferred)) return preferred;
  if (COFFEE_CONTEXT.test(text)) return 'coffee';
  if (GROWTH_CONTEXT.test(text)) return 'leaf';
  if (
    /\b(?:study|studying|students?|learning|education|homework|tutor(?:ing)?|flashcards?)\b/i.test(
      text,
    )
  )
    return 'thinking';
  if (/\b(?:launch|startup|ship|automation|automate)\b/i.test(text))
    return 'rocket';
  if (/\b(?:focus|organize|tasks?|notes?|calendar|schedule)\b/i.test(text))
    return 'focus';
  if (/\b(?:design|drawing|creative|beauty|skincare)\b/i.test(text))
    return 'sparkles';
  return (
    {
      food: 'heart-eyes',
      fitness: 'muscle',
      beauty: 'sparkles',
      travel: 'party',
      productivity: 'focus',
      general: 'sparkles',
    } as const
  )[category];
}

export const REACTION_INSTRUCTION = `For render replies return a reaction ID chosen for the emotional payoff of THIS product and the user's tone, not a generic shocked face. Allowed IDs: ${reactions.map((r) => `${r.id} (${r.emoji}, ${r.mood})`).join('; ')}. Meditation, sleep, mental wellness or stress relief must use calm, leaf or sparkles. Coffee rituals use coffee; plant care uses leaf; learning uses thinking; organization uses focus; fitness uses muscle; beauty/design uses sparkles; food delight uses heart-eyes; launch momentum uses rocket. Reserve mind-blown for an actually surprising product capability and party for celebration. The editor adds the animated emoji; do not describe an emoji inside the generated footage. Return an ID, never an asset URL.`;
