import type { Category, VideoPlan } from './types';
export const categories: Category[] = [
  'food',
  'fitness',
  'productivity',
  'beauty',
  'travel',
  'general',
];
export function extractUrl(text: string): string | null {
  const match = text.match(
    /(?:https?:\/\/[^\s<>]+|(?<![\w@.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]+)(?![\w@-])(?:[/?#][^\s<>]*)?)/i,
  );
  if (!match) return null;
  const raw = match[0].replace(/[),.!?;:'"\]]+$/, '');
  try {
    return new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`).href;
  } catch {
    return null;
  }
}
export function safeUrl(raw: string): URL {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443' && url.port !== '80') ||
    !host.includes('.') ||
    host.includes(':') ||
    /^\d[\d.]*$/.test(host) ||
    /(?:^|\.)(?:localhost|local|internal|test|invalid|lan|home|arpa)$/.test(
      host,
    )
  )
    throw new Error('Please send a public product website URL.');
  return url;
}
export function publicAddress(ip: string): boolean {
  if (ip.includes(':')) return !/^(?:::|fc|fd|fe[89ab]|ff|2001:db8)/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return (
    Number.isFinite(a) &&
    a > 0 &&
    a !== 10 &&
    a !== 127 &&
    a < 224 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0)) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19))
  );
}
export function categoryFor(text: string): Category {
  if (
    /\b(?:calories?|caloric|nutrition(?:al)?|meals?|foods?|recipes?|diet(?:ing)?|eat(?:ing)?|cook(?:ing)?|restaurants?)\b/i.test(
      text,
    )
  )
    return 'food';
  if (/\b(?:fitness|workouts?|gym|running|exercise|training)\b/i.test(text))
    return 'fitness';
  if (/\b(?:beauty|skincare|skin care|makeup|cosmetics?|serums?)\b/i.test(text))
    return 'beauty';
  if (/\b(?:travel|trips?|hotels?|flights?|holidays?|vacations?)\b/i.test(text))
    return 'travel';
  if (
    /\b(?:productivity|notes?|tasks?|meetings?|schedule|projects?|workspace|software|developers?|drawing|design|markdown)\b/i.test(
      text,
    )
  )
    return 'productivity';
  return 'general';
}
export function cleanText(text: string, max = 180) {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
export function metadata(html: string, url: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  function meta(name: string) {
    for (const tag of tags) {
      const attrs = Object.fromEntries(
        [...tag.matchAll(/([\w:-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map((m) => [
          m[1].toLowerCase(),
          m[3],
        ]),
      );
      if (attrs.property === name || attrs.name === name)
        return cleanText(attrs.content || '', 300);
    }
    return '';
  }
  const title =
    meta('og:site_name') ||
    meta('og:title') ||
    cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '', 120);
  const description = meta('description') || meta('og:description');
  const body = cleanText(
    html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' '),
    3500,
  );
  return {
    product: cleanText(
      title.split(/\s[|–—]\s/)[0] ||
        new URL(url).hostname.replace(/^www\./, ''),
      60,
    ),
    description,
    body,
  };
}
export function makePlan(
  product: string,
  url: string,
  description: string,
  category: Category,
  captions?: string[],
): VideoPlan {
  const config = {
    food: { bg: 'food', gif: 'heart-eyes', accent: '#dbfa88' },
    fitness: { bg: 'fitness', gif: 'muscle', accent: '#d9fa74' },
    beauty: { bg: 'beauty', gif: 'heart-eyes', accent: '#ffc4c9' },
    travel: { bg: 'travel', gif: 'party', accent: '#b0eff5' },
    productivity: { bg: 'productivity', gif: 'mind-blown', accent: '#e8f7a3' },
    general: { bg: 'productivity', gif: 'party', accent: '#fedbac' },
  }[category];
  const defaultCaptions = [
    `You just found ${product}`,
    description
      ? description.split(/[.!]/)[0].length > 85
        ? description
            .split(/[.!]/)[0]
            .slice(0, 82)
            .replace(/\s+\S*$/, '') + '…'
        : description.split(/[.!]/)[0]
      : 'Your new favorite just entered the chat',
    `Meet ${product}. You're welcome.`,
  ];
  return {
    product: cleanText(product, 60),
    url,
    description: cleanText(description, 280),
    category,
    captions: (captions?.length === 3
      ? captions.map((c) => cleanText(c, 100))
      : defaultCaptions) as [string, string, string],
    background: `/assets/${config.bg}.jpg`,
    gif: `/assets/${config.gif}.gif`,
    audio: '/assets/gimme-that-groove.mp3',
    accent: config.accent,
    credits: [
      {
        label: 'Photography · Unsplash License',
        url: 'https://unsplash.com/license',
      },
      {
        label: 'Animated reactions · Google Noto (CC BY 4.0)',
        url: 'https://googlefonts.github.io/noto-emoji-animation/',
      },
      {
        label: 'Gimme that Groove! · Michael Ramir C. / Mixkit',
        url: 'https://mixkit.co/free-stock-music/funk/',
      },
    ],
  };
}
