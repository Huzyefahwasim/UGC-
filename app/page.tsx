'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  LoaderCircle,
  Scissors,
  Plus,
  RotateCcw,
  Sparkles,
  Link2,
  Volume2,
  X,
  Clapperboard,
  MonitorPlay,
  WandSparkles,
} from 'lucide-react';
import { StudioWelcome } from './studio-welcome';
import type { VideoPlan } from '@/lib/types';
import { renderVideo } from '@/lib/render';
import { loadFootage } from '@/lib/load-footage';
import { chooseReaction, reactionById } from '@/lib/reactions';

function planReaction(plan: VideoPlan) {
  return reactionById(
    plan.reaction ||
      chooseReaction(`${plan.product} ${plan.description}`, plan.category),
  );
}
type GenerationJob = {
  id: string;
  ticket: string;
  plan: VideoPlan;
  prompt: string;
  startedAt: number;
  recoveryNote?: string;
};
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
    provider?: 'higgsfield' | 'ltx';
  };
  error?: boolean;
  retryPrompt?: string;
};
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [pendingJob, setPendingJob] = useState<GenerationJob | null>(null);
  const [generationReady, setGenerationReady] = useState<boolean | null>(null);
  const [accessRequired, setAccessRequired] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [jobPhase, setJobPhase] = useState('');
  const [copied, setCopied] = useState('');
  const [hydrated, setHydrated] = useState(false);
  const [activePlan, setActivePlan] = useState<VideoPlan | null>(null);
  const [notice, setNotice] = useState('');
  const busyRef = useRef(false);
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const cancel = useRef<AbortController | null>(null);
  const audio = useRef<AudioContext | null>(null);
  function enableAudio() {
    if (typeof AudioContext === 'undefined') return;
    if (!audio.current || audio.current.state === 'closed')
      audio.current = new AudioContext();
    void audio.current.resume().catch(() => {});
  }
  async function finishCut(
    job: GenerationJob,
    renderTicket: string,
    signal: AbortSignal,
    footageUrl?: string,
  ) {
    setJobPhase('finishing');
    setStatus('Adding animated captions, music and your reaction GIF…');
    let footage: HTMLVideoElement | undefined;
    try {
      if (footageUrl) footage = await loadFootage(footageUrl, signal);
      const result = await renderVideo(
        job.plan,
        (_progress, text) => setStatus(text),
        signal,
        audio.current || undefined,
        footage,
      );
      setStatus('Saving your finished cut…');
      let savedUrl: string | undefined;
      try {
        const response = await fetch('/api/videos', {
          method: 'POST',
          headers: {
            'X-Render-Ticket': renderTicket,
            'Content-Type': result.blob.type,
          },
          body: result.blob,
          signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
        });
        const saved = await response.json();
        if (response.ok && typeof saved.url === 'string') savedUrl = saved.url;
      } catch (error) {
        if (signal.aborted) throw error;
        // The export already exists. Preserve a downloadable copy if storage
        // or the network fails instead of discarding successful rendering.
      }
      const local = !savedUrl;
      const url = savedUrl || URL.createObjectURL(result.blob);
      const finalPlan = footageUrl
        ? {
            ...job.plan,
            credits: [
              {
                label: 'AI footage · Lightricks LTX-Video',
                url: 'https://huggingface.co/Lightricks/LTX-Video',
              },
              ...job.plan.credits.filter(
                (credit) => !credit.label.startsWith('Photography'),
              ),
            ],
          }
        : job.plan;
      setMessages((items) => [
        ...items,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `${planReaction(job.plan).emoji} Your ${footageUrl ? '' : 'stock-asset '}cut for ${job.plan.product} is ready.${local ? ' Online saving failed; download this copy before leaving.' : ' Sound on for the full effect.'}`,
          video: {
            url,
            plan: finalPlan,
            poster: result.poster,
            local,
            format: result.blob.type.includes('mp4') ? 'mp4' : 'webm',
            ...(footageUrl ? { provider: 'ltx' as const } : {}),
          },
        },
      ]);
      setPendingJob(null);
      setNotice('');
    } finally {
      if (footage) {
        footage.pause();
        footage.removeAttribute('src');
        footage.load();
      }
    }
  }
  async function finishWithFreeAssets() {
    if (!pendingJob || busyRef.current) return;
    enableAudio();
    setNotice('');
    setStatus('Choosing the assets for your cut…');
    busyRef.current = true;
    setBusy(true);
    const controller = new AbortController();
    cancel.current = controller;
    try {
      const response = await fetch(
        `/api/generations/${pendingJob.id}/fallback`,
        {
          method: 'POST',
          headers: { 'X-Generation-Ticket': pendingJob.ticket },
          signal: controller.signal,
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await finishCut(pendingJob, result.renderTicket, controller.signal);
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not finish the cut.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      cancel.current = null;
      void audio.current?.close().catch(() => {});
    }
  }
  useEffect(() => {
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
      if (
        saved.pendingJob?.id &&
        saved.pendingJob?.ticket &&
        saved.pendingJob?.plan
      )
        setPendingJob(saved.pendingJob);
      if (typeof saved.draft === 'string') setDraft(saved.draft.slice(0, 2400));
    } catch {}
    setHydrated(true);
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        setGenerationReady(!!data.generationConfigured);
        setAccessRequired(!!data.generationAccessRequired);
      })
      .catch(() => {});
    return () => {
      cancel.current?.abort();
      void audio.current?.close().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        'cut-chat-v1',
        JSON.stringify({
          draft,
          pendingJob,
          messages: messages.map((m) => ({
            ...m,
            video: m.video?.local
              ? undefined
              : m.video
                ? {
                    url: m.video.url,
                    plan: m.video.plan,
                    format: m.video.format,
                    provider: m.video.provider,
                  }
                : undefined,
          })),
        }),
      );
    } catch {}
  }, [messages, draft, hydrated, pendingJob]);
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
      end.current?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
  }, [messages, busy]);
  async function watchGeneration(job: GenerationJob, signal: AbortSignal) {
    setActivePlan(job.plan);
    setJobPhase('queued');
    setStatus('Your shot is waiting to be created…');
    // eslint-disable-next-line react/react-compiler -- This clock is read in an async event handler, never during render.
    const deadline = Date.now() + 20 * 60 * 1000;
    let failures = 0;
    // eslint-disable-next-line react/react-compiler -- Polling runs only after a user submits or resumes a job.
    while (Date.now() < deadline) {
      signal.throwIfAborted();
      let finishing = false;
      try {
        const response = await fetch('/api/generations/' + job.id, {
          headers: { 'X-Generation-Ticket': job.ticket },
          signal: AbortSignal.any([signal, AbortSignal.timeout(85000)]),
          cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 403) {
            setPendingJob(null);
            setMessages((items) => [
              ...items,
              {
                id: crypto.randomUUID(),
                role: 'assistant',
                error: true,
                text: 'This generation session has expired. Start a new cut to continue.',
              },
            ]);
            return;
          }
          throw new Error(result.error || 'Could not check generation.');
        }
        failures = 0;
        setJobPhase(result.status);
        if (result.status === 'completed' && result.url) {
          finishing = true;
          await finishCut(job, result.renderTicket, signal, result.url);
          return;
        }
        if (['failed', 'nsfw', 'cancelled'].includes(result.status)) {
          const note =
            result.error ||
            'The footage could not be generated. You can still finish this brief with stock assets.';
          setPendingJob({ ...job, recoveryNote: note });
          setNotice(note);
          return;
        }
        if (result.status === 'not_started') {
          setStatus(
            'The submission did not start. Resume to submit this same job safely.',
          );
          return;
        }
        if (
          result.status === 'submitting' &&
          // eslint-disable-next-line react/react-compiler -- Async job timeout, not render-time state.
          Date.now() - job.startedAt > 330000
        ) {
          setStatus(
            'The video did not finish in time. Use stock assets, or close this request and try a new cut later.',
          );
          return;
        }
        setStatus(
          result.status === 'in_progress'
            ? 'Bringing your scene to life…'
            : result.status === 'submitting'
              ? 'Creating your footage. This can take a few minutes…'
              : 'Your shot is waiting to be created…',
        );
      } catch (error) {
        if (signal.aborted || finishing) throw error;
        failures++;
        if (failures >= 4)
          throw new Error(
            'Could not check this job right now. Resume below; your generation may still be running.',
          );
        setStatus('Reconnecting to your generation…');
      }
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException('Stopped checking', 'AbortError'));
        };
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve();
        }, 4000);
        signal.addEventListener('abort', abort, { once: true });
      });
    }
    setStatus(
      'This generation is taking longer than usual. Resume to check again.',
    );
  }
  async function runGeneration(
    job: GenerationJob,
    controller: AbortController,
  ) {
    setActivePlan(job.plan);
    setJobPhase('queued');
    setStatus('Bringing your scene to life…');
    const response = await fetch('/api/generations', {
      method: 'POST',
      headers: {
        'X-Generation-Ticket': job.ticket,
        'X-Studio-Access': accessCode,
      },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(295000)]),
    });
    if (!response.ok) {
      const result = await response.json();
      if (response.status === 403) {
        setPendingJob(null);
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            error: true,
            text: 'This generation session has expired. Start a new cut to continue.',
          },
        ]);
        return;
      }
      throw new Error(result.error || 'Could not start generation.');
    }
    await watchGeneration(job, controller.signal);
  }
  async function resumeGeneration() {
    if (!pendingJob || busyRef.current) return;
    enableAudio();
    busyRef.current = true;
    setBusy(true);
    const controller = new AbortController();
    cancel.current = controller;
    try {
      await runGeneration(pendingJob, controller);
    } catch (error) {
      const recoveryNote = controller.signal.aborted
        ? 'Stopped checking. Your generation may continue in the background.'
        : error instanceof Error
          ? error.message
          : 'Please resume in a moment.';
      setNotice(recoveryNote);
      setPendingJob({ ...pendingJob, recoveryNote });
    } finally {
      busyRef.current = false;
      setBusy(false);
      cancel.current = null;
      void audio.current?.close().catch(() => {});
    }
  }
  async function send(value = draft) {
    const text = value.trim();
    if (!text || busyRef.current || pendingJob) return;
    enableAudio();
    busyRef.current = true;
    setDraft('');
    setBusy(true);
    setActivePlan(null);
    setStatus('Reading your brief…');
    setNotice('');
    setJobPhase('');
    const history = [
      ...messages,
      { id: crypto.randomUUID(), role: 'user' as const, text },
    ];
    setMessages(history);
    const controller = new AbortController();
    cancel.current = controller;
    let submittedJob: GenerationJob | undefined;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Studio-Access': accessCode,
        },
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
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || 'Something went wrong. Please try again.',
        );
      if (!result.plan)
        setMessages([
          ...history,
          { id: crypto.randomUUID(), role: 'assistant', text: result.message },
        ]);
      else {
        const job: GenerationJob = {
          id: result.jobId,
          ticket: result.ticket,
          plan: result.plan,
          prompt: text,
          // eslint-disable-next-line react/react-compiler -- Timestamp created by the Send event, not by rendering.
          startedAt: Date.now(),
        };
        setPendingJob(job);
        // Persist before submission so a reload or lost response cannot cause a second GPU job.
        try {
          sessionStorage.setItem(
            'cut-chat-v1',
            JSON.stringify({ messages: history, draft: '', pendingJob: job }),
          );
        } catch {}
        submittedJob = job;
        await runGeneration(job, controller);
      }
    } catch (error) {
      const errorText = controller.signal.aborted
        ? submittedJob
          ? 'Stopped checking. Your generation may continue in the background.'
          : 'Stopped. Send another message whenever you’re ready.'
        : error instanceof Error
          ? error.message
          : 'Could not complete this request.';
      if (submittedJob) {
        setNotice(errorText);
        setPendingJob({ ...submittedJob, recoveryNote: errorText });
      } else
        setMessages([
          ...history,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            error: true,
            retryPrompt: controller.signal.aborted ? undefined : text,
            text: errorText,
          },
        ]);
    } finally {
      busyRef.current = false;
      setBusy(false);
      cancel.current = null;
      input.current?.focus();
      void audio.current?.close().catch(() => {});
    }
  }
  function newChat() {
    if (busyRef.current || pendingJob) return;
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
          disabled={busy || !!pendingJob}
          className="brand"
          aria-label="Cut — start a new chat"
        >
          <span className="brand-mark">
            <Scissors size={21} strokeWidth={2.5} />
          </span>
          cut<span className="brand-dot">.</span>
        </button>
        <span className="header-note">
          <Clapperboard size={14} /> Creator studio
        </span>
        <div className="header-actions">
          {accessRequired && (
            <details className="access-settings">
              <summary>Studio access</summary>
              <div>
                <label htmlFor="studio-access">Generation access code</label>
                <input
                  id="studio-access"
                  type="password"
                  autoComplete="current-password"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  placeholder="Enter your studio code"
                />
                <small>
                  Enter the code shared by the owner of this studio.
                </small>
              </div>
            </details>
          )}
          <button
            className="new-chat"
            onClick={newChat}
            disabled={busy || !!pendingJob}
          >
            <Plus size={16} /> New cut
          </button>
        </div>
      </header>
      <section
        className={`conversation ${messages.length ? 'has-messages' : ''}`}
        aria-label="Video creation chat"
      >
        {!messages.length && (
          <StudioWelcome
            onPrompt={(prompt) => {
              setDraft(prompt);
              input.current?.focus();
              input.current?.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                  .matches
                  ? 'instant'
                  : 'smooth',
                block: 'center',
              });
            }}
          />
        )}
        {messages.length > 0 && (
          <h1 className="sr-only">Your video creation chat</h1>
        )}
        {generationReady === false && (
          <output className="setup-notice">
            Video generation needs a connection. Ask the studio owner to finish
            setup; you can still work on your brief here.
          </output>
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
                {message.error &&
                  message.retryPrompt &&
                  !message.text.startsWith('Stopped') && (
                    <button
                      className="retry"
                      disabled={busy || !!pendingJob}
                      onClick={() => send(message.retryPrompt)}
                    >
                      <RotateCcw size={15} /> Try again
                    </button>
                  )}
                {message.video && (
                  <div className="video-card">
                    <div className="video-wrap">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- Legacy Higgsfield videos may contain dialogue without a transcript. LTX cuts include a music caption track. */}
                      <video
                        controls
                        playsInline
                        preload="metadata"
                        src={message.video.url}
                        poster={message.video.poster}
                        aria-label={`${message.video.plan.product} marketing video`}
                      >
                        {message.video.provider !== 'higgsfield' && (
                          <track
                            kind="captions"
                            src="/assets/music-captions.vtt"
                            srcLang="en"
                            label="Music captions"
                          />
                        )}
                      </video>
                      <span className="video-badge">
                        {message.video.provider === 'ltx'
                          ? '6 SEC'
                          : message.video.provider === 'higgsfield'
                            ? 'VIDEO'
                            : '8 SEC'}{' '}
                        <span>•</span> 9:16
                      </span>
                    </div>
                    <div className="video-info">
                      <span className="cut-label">
                        <Clapperboard size={13} /> YOUR CUT
                      </span>
                      <span className="ready">
                        <Check size={14} />{' '}
                        {message.video.local
                          ? 'Ready to download'
                          : 'Ready to share'}
                      </span>
                      <h2>{message.video.plan.product}</h2>
                      <p>
                        <Volume2 size={14} /> Made for the feed. Best with
                        sound.
                      </p>
                      <div className="caption-preview">
                        <span>THE HOOK</span>
                        <blockquote>
                          “{message.video.plan.captions[0]}”
                        </blockquote>
                      </div>
                      <span className="reaction-tag">
                        <span aria-hidden="true">
                          {planReaction(message.video.plan).emoji}
                        </span>
                        {planReaction(message.video.plan).label}
                      </span>
                      <div className="video-actions">
                        <a
                          className="download"
                          href={
                            message.video.local ||
                            message.video.provider === 'higgsfield'
                              ? message.video.url
                              : `${message.video.url}?download=1`
                          }
                          target={
                            message.video.provider === 'higgsfield'
                              ? '_blank'
                              : undefined
                          }
                          rel="noreferrer"
                          download={`cut-${message.video.plan.product.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.${message.video.format || 'mp4'}`}
                        >
                          <Download size={15} />{' '}
                          {message.video.provider === 'higgsfield'
                            ? 'Open / download'
                            : 'Download'}
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
                        <summary>Creative brief & credits</summary>
                        {message.video.provider === 'higgsfield' && (
                          <p className="provider-note">
                            AI-generated footage · Veo 3.1 Fast. Download to
                            keep; provider links are temporary.
                          </p>
                        )}
                        {message.video.provider === 'ltx' && (
                          <p className="provider-note">
                            AI-generated footage · LTX-Video 0.9.8. Cut adds the
                            animated captions, music and reaction GIF.
                          </p>
                        )}
                        <p>{message.video.plan.description}</p>
                        {message.video.plan.shot && (
                          <p>
                            {Object.values(message.video.plan.shot).join(' ')}
                          </p>
                        )}
                        <ol className="caption-list">
                          {message.video.plan.captions.map((caption, i) => (
                            <li key={i}>
                              <b>{['Hook', 'Benefit', 'Close'][i]}</b>
                              {caption}
                            </li>
                          ))}
                        </ol>
                        {message.video.provider !== 'higgsfield' &&
                          message.video.plan.credits.map((credit) => (
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
                        disabled={busy || !!pendingJob}
                        onClick={() =>
                          revise('make the hook punchier', message.video!.plan)
                        }
                      >
                        <Sparkles size={14} /> Punchier
                      </button>
                      <button
                        disabled={busy || !!pendingJob}
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
                  <div className="render-studio">
                    <div className="generation-brief">
                      <span className="generation-symbol" aria-hidden="true">
                        {planReaction(activePlan).emoji}
                      </span>
                      <div>
                        <strong>{activePlan.product}</strong>
                        <span>Your next six-second story</span>
                      </div>
                      <span className="generation-wave" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </span>
                    </div>
                    <blockquote className="generation-hook">
                      “{activePlan.captions[0]}”
                    </blockquote>
                    <div
                      className="render-stages"
                      aria-label="Generation stages"
                    >
                      <span className="complete">
                        <Check size={14} />
                        Brief
                      </span>
                      <span
                        className={
                          jobPhase === 'queued' || jobPhase === 'submitting'
                            ? 'active'
                            : 'complete'
                        }
                      >
                        <WandSparkles size={14} />
                        Create
                      </span>
                      <span
                        className={jobPhase === 'finishing' ? 'active' : ''}
                      >
                        <MonitorPlay size={14} />
                        Edit & finish
                      </span>
                    </div>
                    {activePlan.shot?.action && (
                      <p className="generation-direction">
                        {activePlan.shot.action}
                      </p>
                    )}
                    {jobPhase === 'finishing' && (
                      <span className="render-note">
                        Keep this tab visible while we add the finishing
                        touches.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </article>
          )}
        </div>
        <div ref={end} />
      </section>
      <div className="composer-dock">
        {pendingJob && !busy && (
          <div className="pending-generation">
            <div>
              <strong>{pendingJob.plan.product}</strong>
              <p>
                {notice ||
                  pendingJob.recoveryNote ||
                  status ||
                  'Your generation is saved. Resume to check for the result.'}
              </p>
              <button
                type="button"
                className="retry"
                onClick={() => void finishWithFreeAssets()}
              >
                Finish with stock assets
              </button>
              <details className="tracking-options">
                <summary>Recovery options</summary>
                <a
                  href="https://huggingface.co/spaces/Lightricks/ltx-video-distilled"
                  target="_blank"
                  rel="noreferrer"
                >
                  Check video service <ArrowUpRight size={12} />
                </a>
                <p>
                  Closing tracking does not stop an active request. The official
                  demo shows availability; it does not hold this app’s job
                  history.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMessages((items) => [
                      ...items,
                      {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        text: `Tracking closed for ${pendingJob.plan.product}. ${pendingJob.recoveryNote || 'You can start a new cut when you are ready.'}`,
                      },
                    ]);
                    setPendingJob(null);
                    setNotice('');
                    setStatus('');
                  }}
                >
                  Close tracking
                </button>
              </details>
            </div>
            <button type="button" onClick={() => void resumeGeneration()}>
              <RotateCcw size={14} />
              Check this cut
            </button>
          </div>
        )}
        <div className="composer-inner">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="composer"
          >
            {!messages.length && (
              <div className="composer-label">
                <Link2 size={14} /> YOUR PRODUCT, YOUR DIRECTION
              </div>
            )}
            <label className="sr-only" htmlFor="message">
              Message Cut
            </label>
            <textarea
              ref={input}
              id="message"
              value={draft}
              maxLength={2400}
              disabled={!!pendingJob}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                messages.length
                  ? 'A new idea? A different take?'
                  : 'Paste your product link. What should it feel like?'
              }
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
                  ? activePlan
                    ? 'Creating your cut'
                    : 'Thinking'
                  : 'Short. Vertical. Yours.'}
              </span>
              {busy ? (
                <button
                  type="button"
                  className="send stop"
                  onClick={() => cancel.current?.abort()}
                  aria-label="Stop checking generation"
                >
                  <X size={19} />
                </button>
              ) : (
                <button
                  type="submit"
                  className="send"
                  disabled={!draft.trim() || !!pendingJob}
                  aria-label="Send message"
                >
                  <span>{messages.length ? 'Send' : 'Create a cut'}</span>
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </form>
          <div className="below-composer">
            <span>
              <kbd>Enter</kbd> to send <i>·</i> <kbd>Shift + Enter</kbd> for a
              new line
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
