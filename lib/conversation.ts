import { categoryFor, cleanText, extractUrl } from './product.ts';
import type { Category } from './types';

export type PreviousProduct = {
  product: string;
  description: string;
  url: string;
  category?: Category;
  captions?: string[];
};
export type CreativeReply = {
  kind: 'chat' | 'render';
  reply: string;
  product?: string;
  description?: string;
  category?: Category;
  captions?: string[];
};
type ProductData = { product: string; description: string; body: string };

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
    /\b(?:revise|revision|another version|another cut|remake|punchier|funnier|playful|shorter|change.{0,25}(?:hook|caption))\b/i.test(
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
        : [previous.product, previous.description, `Meet ${previous.product}.`];
    captions[0] =
      quoted ||
      (playful
        ? `${previous.product} just entered the chat.`
        : `Hold on. ${previous.product} exists?`);
    if (!quoted)
      captions[2] = playful
        ? `Go on. Meet ${previous.product}.`
        : `Take a look at ${previous.product}.`;
    return {
      kind: 'render',
      reply: quoted
        ? 'The same product brief with your new hook. Higgsfield will create a fresh generation.'
        : 'Here’s another cut with a fresh hook and closing line.',
      ...previous,
      category: previous.category || categoryFor(previous.description),
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
      reply: `Here’s your cut for ${product}. Play it with sound on.`,
      product,
      description,
      category: categoryFor(description + ' ' + latest),
    };
  }
  if (/^(hi|hello|hey|yo|howdy)(?: there)?[!.\s]*$/i.test(latest))
    return {
      kind: 'chat',
      reply:
        'Hey! What are you building? Send a product link or a short description, and I’ll make you an eight-second video.',
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
        'Send a product URL or introduce it like “I’m building Bloom, a plant-care app.” I’ll prepare a creative brief and use Higgsfield to generate an eight-second vertical video with audio. Then you can ask for a punchier or more playful hook.',
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
