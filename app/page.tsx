'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  LoaderCircle,
  Scissors,
  Film,
  Music2,
  Plus,
  RotateCcw,
  Sparkles,
  Link2,
  Volume2,
  CircleHelp,
  X,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { VideoPlan } from '@/lib/types';
type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  video?: {
    url: string;
    plan: VideoPlan;
    poster?: string;
    local?: boolean;
    format?: 'mp4' | 'webm';
  };
  error?: boolean;
  retryPrompt?: string;
};
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [activePlan, setActivePlan] = useState<VideoPlan | null>(null);
  const [notice, setNotice] = useState('');
  const busyRef = useRef(false);
  const objectUrls = useRef<string[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const cancel = useRef<AbortController | null>(null);
  useEffect(() => {
    const urls = objectUrls.current;
    try {
      const saved = JSON.parse(sessionStorage.getItem('cut-chat-v1') || '{}');
      if (Array.isArray(saved.messages))
        // Session storage is only available after the server-rendered page hydrates.
        // eslint-disable-next-line react/react-compiler
        setMessages(
          saved.messages
            .filter(
              (m: Message) =>
                m &&
                typeof m.text === 'string' &&
                ['user', 'assistant'].includes(m.role),
            )
            .slice(-60),
        );
      if (typeof saved.draft === 'string') setDraft(saved.draft.slice(0, 2400));
    } catch {}
    setHydrated(true);
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setAiReady(!!data.aiConfigured))
      .catch(() => {});
    return () => {
      cancel.current?.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        'cut-chat-v1',
        JSON.stringify({
          draft,
          messages: messages.map((m) => ({
            ...m,
            video: m.video?.local
              ? undefined
              : m.video
                ? {
                    url: m.video.url,
                    plan: m.video.plan,
                    format: m.video.format,
                  }
                : undefined,
          })),
        }),
      );
    } catch {}
  }, [messages, draft, hydrated]);
  useEffect(() => {
    if (!input.current) return;
    input.current.style.height = 'auto';
    input.current.style.height = `${Math.min(input.current.scrollHeight, 160)}px`;
  }, [draft]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'draft_chat_message',
          title: 'Draft a message to Cut',
          description:
            'Fill the visible chat composer. This does not send a message or render a video; the user presses Send.',
          inputSchema: {
            type: 'object',
            properties: {
              message: { type: 'string', minLength: 1, maxLength: 2400 },
            },
            required: ['message'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(value: unknown) {
            const message = (value as { message?: unknown })?.message;
            if (
              typeof message !== 'string' ||
              !message.trim() ||
              message.length > 2400
            )
              throw new Error('Provide a message from 1 to 2400 characters.');
            setDraft(message);
            input.current?.focus();
            return { draft: message, sent: false };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    if (messages.length || busy)
      end.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);
  async function send(value = draft) {
    const text = value.trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setDraft('');
    setBusy(true);
    setProgress(0);
    setActivePlan(null);
    setStatus('Thinking…');
    const history = [
      ...messages,
      { id: crypto.randomUUID(), role: 'user' as const, text },
    ];
    setMessages(history);
    const controller = new AbortController();
    cancel.current = controller;
    let audio: AudioContext | undefined;
    try {
      if (typeof AudioContext !== 'undefined') {
        audio = new AudioContext();
        void audio.resume().catch(() => {});
      }
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history
            .slice(-16)
            .filter((m) => !m.error)
            .map((m) => ({ role: m.role, content: m.text })),
          previousPlan: messages.findLast((m) => m.video)?.video?.plan,
        }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(60000),
        ]),
      });
      const result = (await response.json()) as {
        error?: string;
        message: string;
        plan?: VideoPlan;
        ticket: string;
      };
      if (!response.ok)
        throw new Error(
          result.error || 'Something went wrong. Please try again.',
        );
      if (!result.plan)
        setMessages((m) => [
          ...m,
          { id: crypto.randomUUID(), role: 'assistant', text: result.message },
        ]);
      else {
        setStatus(`Making a cut for ${result.plan.product}…`);
        setActivePlan(result.plan);
        const { renderVideo } = await import('@/lib/render');
        const { blob, poster } = await renderVideo(
          result.plan,
          (value, label) => {
            setProgress(value);
            setStatus(label);
          },
          controller.signal,
          audio,
        );
        setStatus('Saving your video…');
        setProgress(96);
        const localUrl = URL.createObjectURL(blob);
        const format = blob.type.includes('webm')
          ? ('webm' as const)
          : ('mp4' as const);
        objectUrls.current.push(localUrl);
        if (blob.size > 4000000) {
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: 'Your video is ready to download. It exceeded the sharing upload limit, so this copy is available only in this tab.',
              video: {
                url: localUrl,
                plan: result.plan!,
                poster,
                local: true,
                format,
              },
            },
          ]);
          return;
        }
        let saved: { error?: string; url: string };
        try {
          const upload = await fetch('/api/videos', {
            method: 'POST',
            headers: {
              'Content-Type': blob.type,
              'X-Render-Ticket': result.ticket,
            },
            body: blob,
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(30000),
            ]),
          });
          saved = (await upload.json()) as { error?: string; url: string };
          if (!upload.ok)
            throw new Error(saved.error || 'Could not save the video.');
        } catch (error) {
          if (controller.signal.aborted) throw error;
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              text: 'The video rendered, but its share link couldn’t be saved. You can still download it below. Keep this tab open until you do.',
              video: {
                url: localUrl,
                plan: result.plan!,
                poster,
                local: true,
                format,
              },
            },
          ]);
          return;
        }
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: result.message,
            video: { url: saved.url, plan: result.plan!, poster, format },
          },
        ]);
      }
    } catch (error) {
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          error: true,
          retryPrompt: text,
          text: controller.signal.aborted
            ? 'Stopped. Send another message whenever you’re ready.'
            : error instanceof Error
              ? error.message
              : 'Could not finish this cut. Please try again.',
        },
      ]);
    } finally {
      void audio?.close().catch(() => {});
      busyRef.current = false;
      setBusy(false);
      cancel.current = null;
      input.current?.focus();
    }
  }
  function newChat() {
    if (busyRef.current) return;
    setMessages([]);
    setDraft('');
    setActivePlan(null);
    setNotice('New chat started.');
    input.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function revise(value: string, plan: VideoPlan) {
    setDraft(`For ${plan.product}: ${value}`);
    input.current?.focus();
  }
  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(new URL(url, location.origin).href);
      setCopied(url);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      window.prompt('Copy your video link', new URL(url, location.origin).href);
    }
  }
  return (
    <main className={`studio ${messages.length ? 'in-chat' : ''}`}>
      <a className="skip-link" href="#message">
        Skip to message
      </a>
      <header className="topbar">
        <button
          type="button"
          onClick={newChat}
          disabled={busy}
          className="brand"
          aria-label="Cut — start a new chat"
        >
          <span className="brand-mark">
            <Scissors size={21} strokeWidth={2.5} />
          </span>
          cut<span className="brand-dot">.</span>
        </button>
        <span className="header-note">
          A little chat. A great little video.
        </span>
        <div className="header-actions">
          {aiReady !== null && (
            <span
              className={`mode-badge ${aiReady ? 'connected' : ''}`}
              title={
                aiReady
                  ? 'Creative assistant connected'
                  : 'Product videos and simple hook edits are available. Free-form chat needs an AI provider.'
              }
            >
              <span />
              {aiReady ? 'Creative assistant' : 'Basic mode'}
            </span>
          )}
          {messages.length > 0 && (
            <button className="new-chat" onClick={newChat} disabled={busy}>
              <Plus size={16} /> New chat
            </button>
          )}
        </div>
      </header>
      <section
        className={`conversation ${messages.length ? 'has-messages' : ''}`}
        aria-label="Video creation chat"
      >
        {!messages.length && (
          <div className="welcome">
            <div className="welcome-kicker">
              <span /> YOUR NEXT POST STARTS HERE
            </div>
            <h1>
              Got a link?
              <br />
              Let’s make it <span>move.</span>
            </h1>
            <p>
              Send a product link. Get a short video with bold captions,
              <br className="desktop-break" /> a good beat, and a reaction worth
              watching.
            </p>
            <div className="ingredient-strip" aria-label="Video ingredients">
              <span>
                <Film size={16} /> Real visuals
              </span>
              <i>+</i>
              <span className="type-ingredient">
                Aa <b>Bold captions</b>
              </span>
              <i>+</i>
              <span>
                <Music2 size={16} /> Music
              </span>
              <i>+</i>
              <span>
                <Image
                  unoptimized
                  src="/assets/mind-blown.gif"
                  width="34"
                  height="34"
                  alt=""
                />{' '}
                Reaction GIF
              </span>
            </div>
          </div>
        )}
        {messages.length > 0 && (
          <h1 className="sr-only">Your video creation chat</h1>
        )}
        <div
          className="messages"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              {message.role === 'assistant' && (
                <span className="avatar">
                  <Scissors size={17} />
                </span>
              )}
              <div className="message-content">
                {message.role === 'assistant' && (
                  <span className="sender">Cut</span>
                )}
                <p className={message.error ? 'error-copy' : ''}>
                  {message.text}
                </p>
                {message.error && !message.text.startsWith('Stopped') && (
                  <button
                    className="retry"
                    disabled={busy}
                    onClick={() => send(message.retryPrompt)}
                  >
                    <RotateCcw size={15} /> Try again
                  </button>
                )}
                {message.video && (
                  <div className="video-card">
                    <div className="video-wrap">
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={message.video.url}
                        poster={message.video.poster}
                        aria-label={`${message.video.plan.product} marketing video`}
                      >
                        <track
                          kind="captions"
                          src="/assets/music-captions.vtt"
                          srcLang="en"
                          label="Music captions"
                        />
                      </video>
                      <span className="video-badge">
                        8 SEC <span>•</span> 9:16
                      </span>
                    </div>
                    <div className="video-info">
                      <span className="ready">
                        <Check size={14} />{' '}
                        {message.video.local
                          ? 'Ready to download'
                          : 'Ready to share'}
                      </span>
                      <h2>{message.video.plan.product}</h2>
                      <p>
                        <Volume2 size={14} /> 720p vertical · Sound on
                      </p>
                      <div className="caption-preview">
                        <span>THE HOOK</span>
                        <blockquote>
                          “{message.video.plan.captions[0]}”
                        </blockquote>
                      </div>
                      <div className="video-actions">
                        <a
                          className="download"
                          href={
                            message.video.local
                              ? message.video.url
                              : `${message.video.url}?download=1`
                          }
                          download={`cut-${message.video.plan.product.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.${message.video.format || 'mp4'}`}
                        >
                          <Download size={15} /> Download
                        </a>
                        {!message.video.local && (
                          <button onClick={() => copy(message.video!.url)}>
                            {copied === message.video.url ? (
                              <Check size={15} />
                            ) : (
                              <Copy size={15} />
                            )}{' '}
                            {copied === message.video.url
                              ? 'Copied'
                              : 'Copy link'}
                          </button>
                        )}
                      </div>
                      {!message.video.local && (
                        <a
                          className="open-video"
                          href={message.video.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open video <ArrowUpRight size={13} />
                        </a>
                      )}
                      <details>
                        <summary>What’s in this cut</summary>
                        <p>{message.video.plan.description}</p>
                        <ol className="caption-list">
                          {message.video.plan.captions.map((caption, i) => (
                            <li key={i}>
                              <b>{['Hook', 'Benefit', 'Close'][i]}</b>
                              {caption}
                            </li>
                          ))}
                        </ol>
                        {message.video.plan.credits.map((credit) => (
                          <a
                            key={credit.url}
                            href={credit.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {credit.label} <ArrowUpRight size={11} />
                          </a>
                        ))}
                      </details>
                    </div>
                  </div>
                )}
                {message.video &&
                  message.id === messages.findLast((m) => m.video)?.id && (
                    <div className="revision-options">
                      <span>Try another take</span>
                      <button
                        disabled={busy}
                        onClick={() =>
                          revise('make the hook punchier', message.video!.plan)
                        }
                      >
                        <Sparkles size={14} /> Punchier
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          revise(
                            'make the hook more playful',
                            message.video!.plan,
                          )
                        }
                      >
                        More playful <ArrowUpRight size={13} />
                      </button>
                    </div>
                  )}
              </div>
            </article>
          ))}
          {busy && (
            <article className="message assistant">
              <span className="avatar">
                <Scissors size={17} />
              </span>
              <div className="message-content working">
                <span className="sender">Cut</span>
                <p>
                  <LoaderCircle className="spin" size={15} />
                  {status}
                </p>
                {activePlan && (
                  <div className="render-assets">
                    <Image
                      unoptimized
                      width={40}
                      height={54}
                      src={activePlan.background}
                      alt="Selected background"
                    />
                    <span>+</span>
                    <Image
                      unoptimized
                      width={45}
                      height={54}
                      src={activePlan.gif}
                      alt="Selected reaction GIF"
                    />
                    <div>
                      <strong>{activePlan.product}</strong>
                      <span>Three beats. One fresh cut.</span>
                    </div>
                  </div>
                )}
                {progress > 0 && (
                  <>
                    <Progress value={progress} className="render-progress" />
                    <span className="render-note">
                      Keep this tab visible while your video comes together.
                    </span>
                  </>
                )}
              </div>
            </article>
          )}
        </div>
        <div ref={end} />
      </section>
      <div className="composer-dock">
        <div className="composer-inner">
          {!messages.length && (
            <div className="suggestions">
              <button
                onClick={() =>
                  send(
                    "I'm building CalAI, a calorie-tracking app. Here's the site: calai.app",
                  )
                }
              >
                <Link2 size={14} /> Try calai.app <ArrowUpRight size={13} />
              </button>
              <button
                onClick={() => {
                  setDraft("I'm building ");
                  input.current?.focus();
                }}
              >
                <Plus size={14} /> My product
              </button>
              <button onClick={() => send('What can you do?')}>
                <CircleHelp size={14} /> What can you do?
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="composer"
          >
            <label className="sr-only" htmlFor="message">
              Message Cut
            </label>
            <textarea
              ref={input}
              id="message"
              value={draft}
              maxLength={2400}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Drop a product link, or just say hi…"
              rows={1}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="composer-bottom">
              <span>
                <span className="status-dot" />{' '}
                {busy
                  ? 'Making something good'
                  : '8 seconds · Vertical · Ready to share'}
              </span>
              {busy ? (
                <button
                  type="button"
                  className="send stop"
                  onClick={() => cancel.current?.abort()}
                  aria-label="Stop rendering"
                >
                  <X size={19} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="send"
                  disabled={!draft.trim()}
                  aria-label="Send message"
                >
                  <ArrowUp size={20} />
                </button>
              )}
            </div>
          </form>
          <div className="below-composer">
            <span>Existing media. A fresh point of view.</span>
            <span>
              Enter to send <i>·</i> Shift + Enter for a new line
            </span>
          </div>
        </div>
      </div>
      <output className="sr-only">
        {notice || (copied ? 'Video link copied' : '')}
      </output>
    </main>
  );
}
