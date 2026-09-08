'use client';

import { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import {
  ArrowUpRight,
  Film,
  Music2,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react';

const examples = [
  {
    product: 'Glow Theory',
    type: 'BEAUTY',
    background: 'beauty',
    gif: 'heart-eyes',
    hook: ['Your routine.', 'A little glow-up.'],
    prompt:
      "I'm building Glow Theory, a skincare brand for a simple daily glow routine.",
  },
  {
    product: 'CalAI',
    type: 'FOOD & WELLNESS',
    background: 'food',
    gif: 'mind-blown',
    hook: ['Wait. That’s', 'all it takes?'],
    prompt:
      "I'm building CalAI, a calorie-tracking app. Here's the site: calai.app",
  },
  {
    product: 'Tempo',
    type: 'FITNESS',
    background: 'fitness',
    gif: 'muscle',
    hook: ['New routine.', 'Who’s this?'],
    prompt:
      "I'm building Tempo, a fitness app that makes daily workouts easy to stick to.",
  },
];

function subscribeMotion(callback: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

export function StudioWelcome({
  onPrompt,
}: {
  onPrompt: (prompt: string) => void;
}) {
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true,
  );
  const moving = !paused && !reducedMotion;

  return (
    <div className="welcome" data-motion={moving}>
      <div className="welcome-copy">
        <div className="welcome-kicker">
          <span /> SMALL VIDEOS. BIG MAIN-CHARACTER ENERGY.
        </div>
        <h1>
          Your product.
          <br />
          Their next <span>obsession.</span>
        </h1>
        <p>
          A product link becomes a creator-style video.
          <br className="desktop-break" /> Directed scenes. Natural movement.
          Sound that fits.
        </p>
        <div className="ingredient-strip" aria-label="Your video direction">
          <span>
            <Film size={14} /> Directed scenes
          </span>
          <span>
            <span className="type-ingredient">Aa</span> Strong hooks
          </span>
          <span>
            <Music2 size={14} /> Music + reactions
          </span>
          <span>
            <Sparkles size={14} /> Vertical video
          </span>
        </div>
      </div>
      <div className="showcase">
        <div className="showcase-label">
          <span>A FEW CREATIVE DIRECTIONS</span>
          <button
            type="button"
            onClick={() => setPaused(!paused)}
            disabled={reducedMotion}
            aria-label={
              moving ? 'Pause example animations' : 'Play example animations'
            }
            title={
              reducedMotion
                ? 'Reduced motion is enabled on your device'
                : undefined
            }
          >
            {moving ? <Pause size={12} /> : <Play size={12} />}{' '}
            {moving ? 'Pause' : 'Play'}
          </button>
        </div>
        <div className="example-grid">
          {examples.map((example, index) => (
            <button
              type="button"
              className={`example-card example-${index}`}
              key={example.product}
              onClick={() => onPrompt(example.prompt)}
              aria-label={`Try ${example.product} — ${example.type.toLowerCase()} example`}
            >
              <Image
                className="example-photo"
                unoptimized
                src={`/assets/${example.background}.jpg`}
                width={360}
                height={640}
                alt=""
              />
              <span className="example-shade" />
              <span className="example-top">
                <span>{example.type}</span>
                <span>00:06</span>
              </span>
              <span className="example-caption">
                <span>{example.hook[0]}</span>
                <strong>{example.hook[1]}</strong>
              </span>
              <Image
                className="example-gif"
                unoptimized
                src={`/assets/${example.gif}.${moving ? 'gif' : 'png'}`}
                width={120}
                height={120}
                alt=""
              />
              <span className="example-footer">
                <span>
                  <b>{example.product}</b>
                  <span>Concept preview</span>
                </span>
                <span className="example-open">
                  <ArrowUpRight size={17} />
                </span>
              </span>
              <span className="example-timeline">
                <i />
                <i />
                <i />
              </span>
            </button>
          ))}
        </div>
        <div className="showcase-caption">
          <span>Concept previews, not generated results.</span>
          <span>
            Pick an example to start <ArrowUpRight size={12} />
          </span>
        </div>
      </div>
    </div>
  );
}
