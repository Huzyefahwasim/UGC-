'use client';

import { useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import { ArrowUpRight, Music2, Pause, Play, Sparkles } from 'lucide-react';

const examples = [
  {
    product: 'Glow Theory',
    type: 'BEAUTY',
    background: 'beauty',
    gif: 'heart-eyes',
    hook: ['Less routine.', 'More glow.'],
    prompt:
      "I'm building Glow Theory, a skincare brand for a simple daily glow routine. Make a warm, close-up morning scene for busy people who want fewer steps, with a playful glow-up reaction.",
  },
  {
    product: 'CalAI',
    type: 'FOOD & WELLNESS',
    background: 'food',
    gif: 'mind-blown',
    hook: ['Wait. That’s', 'all it takes?'],
    prompt:
      "I'm building CalAI, a calorie-tracking app. Here's the site: calai.app. Show a relatable lunch moment for someone tired of logging every ingredient. Make it bright, casual and surprising.",
  },
  {
    product: 'Tempo',
    type: 'FITNESS',
    background: 'fitness',
    gif: 'muscle',
    hook: ['New routine.', 'Who’s this?'],
    prompt:
      "I'm building Tempo, a fitness app that makes daily workouts easy to stick to. Show the small win of finishing a morning workout at home, for people starting a new habit. Keep it encouraging and energetic.",
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
          <span /> A SMALL VIDEO. A STRONG FIRST IMPRESSION.
        </div>
        <h1>
          Your product.
          <br />
          <span>Made to move.</span>
        </h1>
        <p>
          Drop a link. We’ll turn what makes it good into a short video with a
          hook, a beat, and a reaction that fits.
        </p>
        <div className="ingredient-strip" aria-label="Your video direction">
          <span>
            <span className="type-ingredient">Aa</span> Hooks that land
          </span>
          <span>
            <Music2 size={14} /> Sound that fits
          </span>
          <span>
            <Sparkles size={14} /> Reactions with personality
          </span>
        </div>
      </div>
      <div className="showcase">
        <div className="showcase-label">
          <span>FIND YOUR ANGLE</span>
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
                  <span>Try this direction</span>
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
          <span>Concept previews · Pick one to shape your brief.</span>
        </div>
      </div>
    </div>
  );
}
