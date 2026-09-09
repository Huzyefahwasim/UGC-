export type Category =
  | 'food'
  | 'fitness'
  | 'productivity'
  | 'beauty'
  | 'travel'
  | 'general';
export type VideoPlan = {
  engine?: 'stock' | 'wan' | 'ltx';
  reference?: import('./wan-config').WanReference;
  product: string;
  url: string;
  description: string;
  category: Category;
  captions: [string, string, string];
  background: string;
  gif: string;
  reaction?: import('./reactions').ReactionId;
  audio: string;
  accent: string;
  shot?: import('./video-direction').ShotDirection;
  credits: { label: string; url: string }[];
};
