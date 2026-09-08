export type Category =
  | 'food'
  | 'fitness'
  | 'productivity'
  | 'beauty'
  | 'travel'
  | 'general';
export type VideoPlan = {
  product: string;
  url: string;
  description: string;
  category: Category;
  captions: [string, string, string];
  background: string;
  gif: string;
  audio: string;
  accent: string;
  shot?: import('./video-direction').ShotDirection;
  credits: { label: string; url: string }[];
};
