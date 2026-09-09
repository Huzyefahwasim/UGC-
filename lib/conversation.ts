import { categoryFor, cleanText, extractUrl } from './product.ts';
import type { Category } from './types.ts';
import type { ShotDirection } from './video-direction.ts';
import { chooseReaction, reactions, type ReactionId } from './reactions.ts';

export type PreviousProduct = {
  product: string;
  description: string;
  url: string;
  category?: Category;
  captions?: string[];
  shot?: ShotDirection;
  reaction?: ReactionId;
};
export type CreativeReply = {
  shot?: ShotDirection;
  reaction?: ReactionId;
  kind: 'chat' | 'render';
  reply: string;
  product?: string;
  description?: string;
  category?: Category;
  captions?: string[];
};
type ProductData = { product: string; description: string; body: string };

function requestedReaction(text: string): ReactionId | undefined {
  // Only read the requested replacement, so "use leaf instead of party"
  // cannot accidentally select the reaction the user wants to remove.
  const request = text.match(
    /\b(?:use|add|choose|pick)\s+(?:(?:an?|the)\s+)?([^.!?\n]{1,90})|\b(?:change|switch|replace)\b.{0,40}\b(?:to|with)\s+(?:(?:an?|the)\s+)?([^.!?\n]{1,90})/i,
  );
  if (
    !request ||
    /\b(?:don['’]t|do not|never)\s*$/i.test(text.slice(0, request.index))
  )
    return undefined;
  const replacement = (request[1] || request[2]).split(/\binstead of\b/i)[0];
  const matches = reactions.flatMap((reaction) => {
    const name = new RegExp(
      `\\b${reaction.id.replace(/-/g, '[- ]')}\\b`,
      'i',
    ).exec(replacement);
    const emojiIndex = replacement.indexOf(reaction.emoji);
    const index = Math.min(
      name?.index ?? Infinity,
      emojiIndex < 0 ? Infinity : emojiIndex,
    );
    return Number.isFinite(index) ? [{ id: reaction.id, index }] : [];
  });
  return matches.sort((a, b) => a.index - b.index)[0]?.id;
}

export function intentFor(text: string, hasPrevious = false) {
  const words = text
    .replace(/https?:\/\/\S+|\b[^\s@]+\.[a-z]{2,}(?:[/?#]\S*)?/gi, '')
    .trim();
  if (
    /\b(?:don['’]t|do not|never|not)\b.{0,60}\b(?:render|make|create|generate|video|ad)\b/i.test(
      words,
    )
  )
    return 'chat';
  if (
    /^(?:(?:can|could|would) you\s+(?:explain|tell|describe|compare|help me understand)|what|why|how|who|when|where|should|explain|tell me)\b/i.test(
      words,
    )
  )
    return 'chat';
  const create =
    /\b(?:make|create|render|generate|assemble|produce|cut)\b.{0,55}\b(?:video|ad|cut|promo)\b/i.test(
      words,
    );
  const intro =
    !!suppliedProduct(text) ||
    /\b(?:i['’]m|i am|we['’]re|we are)\s+(?:building|launching|promoting)\b/i.test(
      words,
    );
  if (
    hasPrevious &&
    !extractUrl(text) &&
    !intro &&
    /\b(?:revise|revision|another version|another cut|remake|punchier|funnier|playful|shorter|calmer|more relaxed|more energetic|more cinematic|(?:change|update|replace|use|add|make).{0,35}(?:hook|caption|emoji|reaction|camera|lighting|scene|shot|vibe)|make (?:it|this) (?:calm|cozy|bold|fun|bright|moody))\b/i.test(
      words,
    )
  )
    return 'revise';
  if (create || intro) return 'render';
  if (
    /^(?:what|why|how|who|when|where|is|are|does|do|can|could|would|should|tell me|explain)\b/i.test(
      words,
    )
  )
    return 'chat';
  return extractUrl(text) ? 'render' : 'chat';
}

export function suppliedProduct(text: string) {
  const match =
    text.match(
      /(?:building|launching|promoting|(?:my|our) (?:product|app) is|video for|ad for)\s+([^,\n:]{1,60})\s*[,：:]\s*((?:an?|the)\s+[^.!?\n]{3,180})/i,
    ) || text.match(/^([^,\n:]{1,60})\s+is\s+((?:an?|the)\s+[^.!?\n]{3,180})/i);
  return match
    ? {
        product: cleanText(match[1], 60),
        description: cleanText(match[2], 180),
      }
    : undefined;
}

export function contextualCaptions(
  product: string,
  description: string,
): [string, string, string] {
  const facts = `${product} ${description}`.toLowerCase();
  let hook = 'A little upgrade to your everyday.';
  if (
    /\b(meditation|mindfulness|meditate|headspace|mental wellness)\b/.test(
      facts,
    )
  )
    hook = 'Too many tabs open in your head?';
  else if (/\b(sleep|bedtime|insomnia)\b/.test(facts))
    hook = 'Your evening deserves a softer landing.';
  else if (
    /\b(study|student|students|academic|homework|learning|education|school|revision)\b/.test(
      facts,
    )
  )
    hook = 'For the part of studying that feels like a lot.';
  else if (/\b(plant|plants|watering|gardening)\b/.test(facts))
    hook = 'Your plants have entered the group chat.';
  else if (/\b(coffee|espresso|roaster|roastery)\b/.test(facts))
    hook = 'The best part of your morning ritual.';
  else if (/\b(calories?|nutrition|meal|meals|food tracking)\b/.test(facts))
    hook = 'What is actually in your lunch?';
  else if (/\b(fitness|workout|workouts|gym|exercise)\b/.test(facts))
    hook = 'A little motivation for your next rep.';
  else if (/\b(skincare|skin care|serum|beauty)\b/.test(facts))
    hook = 'A moment for your daily ritual.';
  else if (/\b(travel|trip|trips|vacation|flight|flights)\b/.test(facts))
    hook = 'Already thinking about your next escape?';
  else if (
    /\b(notes?|tasks?|meetings?|schedule|productivity|workspace)\b/.test(facts)
  )
    hook = 'When your to-do list needs its own to-do list.';
  const fact = cleanText(description, 280).split(/[.!?](?:\s|$)/)[0];
  const benefit =
    fact.length > 75
      ? `${fact.slice(0, 72).replace(/\s+\S*$/, '')}…`
      : fact || `A closer look at ${cleanText(product, 48)}.`;
  return [hook, benefit, `Explore ${cleanText(product, 60)}.`];
}

export function revisionCaptions(
  previous: string[] | undefined,
  proposed: string[],
  request: string,
): string[] {
  if (previous?.length !== 3 || proposed.length !== 3) return proposed;
  const targets = [
    /\b(hook|opening|first (?:caption|line|beat))\b/i.test(request),
    /\b(benefit|middle|second (?:caption|line|beat))\b/i.test(request),
    /\b(cta|call to action|closing|last (?:caption|line|beat)|third (?:caption|line|beat))\b/i.test(
      request,
    ),
  ];
  if (!targets.some(Boolean)) {
    const textChange =
      /\b(captions?|copy|words?|punchier|funnier|playful|shorter|another (?:cut|version)|remake)\b/i.test(
        request,
      );
    return textChange ? proposed : [...previous];
  }
  const revised = previous.map((caption, index) =>
    targets[index] ? proposed[index] : caption,
  );
  const quotedHook = request.match(
    /(?:hook|opening)(?:\s+to|\s+is|:)?\s*["“]([^"”]{1,100})["”]/i,
  )?.[1];
  if (quotedHook) revised[0] = quotedHook;
  return revised;
}

export function fallbackReply(
  latest: string,
  website?: ProductData,
  previous?: PreviousProduct,
  readError = '',
): CreativeReply {
  const intent = intentFor(latest, !!previous);
  const supplied = suppliedProduct(latest);
  if (intent === 'revise' && previous) {
    const playful = /funny|funnier|playful/i.test(latest);
    const quoted = latest.match(
      /(?:hook|caption)(?:\s+to|\s+is|:)?\s*["“]([^"”]{1,100})["”]/i,
    )?.[1];
    const captions =
      previous.captions?.length === 3
        ? [...previous.captions]
        : contextualCaptions(previous.product, previous.description);
    const captionChange =
      /hook|caption|punchier|funnier|playful|shorter|another (?:cut|version)|remake/i.test(
        latest,
      );
    if (quoted) captions[0] = quoted;
    else if (captionChange) {
      const calmProduct =
        /meditation|mindfulness|sleep|mental wellness|headspace/i.test(
          `${previous.product} ${previous.description}`,
        );
      captions[0] = calmProduct
        ? 'Your next small moment of calm.'
        : playful
          ? `${previous.product} just entered the chat.`
          : contextualCaptions(previous.product, previous.description)[0];
    }
    return {
      kind: 'render',
      reply: quoted
        ? 'I’ll keep your concept and change the hook to your words.'
        : 'I’ll keep the product context and work your changes into the next cut.',
      ...previous,
      category: previous.category || categoryFor(previous.description),
      reaction: chooseReaction(
        `${previous.product} ${previous.description}`,
        previous.category || categoryFor(previous.description),
        requestedReaction(latest) || previous.reaction,
      ),
      captions,
    };
  }
  if (intent === 'render' && (supplied || website)) {
    const product = supplied?.product || website!.product;
    const description =
      supplied?.description ||
      website!.description ||
      cleanText(website!.body, 180);
    return {
      kind: 'render',
      reply: `I’ll build a short cut around ${product}, with a clear hook and a reaction that fits.`,
      product,
      description,
      category: categoryFor(description + ' ' + latest),
      reaction: chooseReaction(
        `${product} ${description}`,
        categoryFor(description + ' ' + latest),
        requestedReaction(latest),
      ),
      captions: contextualCaptions(product, description),
    };
  }
  if (/^(hi|hello|hey|yo|howdy)(?: there)?[!.\s]*$/i.test(latest))
    return {
      kind: 'chat',
      reply:
        'Hey! What are you building? Send a product link or a short description, and I’ll make you a eight-second video.',
    };
  if (/^(thanks|thank you|nice|great|awesome|love it)[!.\s]*$/i.test(latest))
    return {
      kind: 'chat',
      reply: previous
        ? 'Glad you like it! You can download it, share the link, or ask for a punchier hook.'
        : 'You’re welcome! Send your product whenever you’re ready.',
    };
  if (
    /\b(?:what can you|how does (?:this|it) work|help|who are you)\b/i.test(
      latest,
    )
  )
    return {
      kind: 'chat',
      reply:
        'Send a product URL or tell me what you’re building. I’ll turn it into a short marketing video with a clear hook, animated captions, music and a matching reaction. Tell me the audience or vibe if you have one in mind, and we can refine it together.',
    };
  if (intent === 'render')
    return {
      kind: 'chat',
      reply: readError
        ? 'I couldn’t read that website. Tell me the product name and what it does, for example “I’m building Bloom, a plant-care app,” and I can work from that.'
        : 'What’s the product called, and what does it do? Add its website if you have one.',
    };
  return {
    kind: 'chat',
    reply:
      'I’m running in basic mode while the AI assistant is being connected. I can make product videos and adjust their hooks. Send a product link, or describe its name and what it does.',
  };
}
