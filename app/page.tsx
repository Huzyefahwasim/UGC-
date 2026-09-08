'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, Check, Copy, Download, LoaderCircle, Scissors, Film, Music2, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { VideoPlan } from '@/lib/types';
type Message = { id: string; role: 'user' | 'assistant'; text: string; video?: { url: string; plan: VideoPlan }; error?: boolean };
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [copied, setCopied] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const cancel = useRef<AbortController | null>(null);
  useEffect(() => { if(messages.length || busy) end.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, status]);
  async function send(value = draft) {
    const text = value.trim();
    if (!text || busy) return;
    setDraft(''); setLastPrompt(text); setBusy(true); setProgress(0); setStatus('Thinking…');
    const history = [...messages, { id: crypto.randomUUID(), role: 'user' as const, text }];
    setMessages(history);
    const controller = new AbortController(); cancel.current = controller;
    const audio = typeof AudioContext !== 'undefined' ? new AudioContext() : undefined;
    void audio?.resume();
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: history.slice(-16).map(m => ({ role: m.role, content: m.text })), previousPlan: messages.findLast(m => m.video)?.video?.plan }), signal: controller.signal });
      const result = await response.json() as { error?: string; message: string; plan?: VideoPlan; ticket: string };
      if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
      if (!result.plan) setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', text: result.message }]);
      else {
        setStatus(`Making a cut for ${result.plan.product}…`);
        const { renderVideo } = await import('@/lib/render');
        const blob = await renderVideo(result.plan, (value, label) => { setProgress(value); setStatus(label); }, controller.signal, audio);
        setStatus('Saving your video…'); setProgress(96);
        const upload = await fetch('/api/videos', { method: 'POST', headers: { 'Content-Type': blob.type, 'X-Render-Ticket': result.ticket }, body: blob, signal: controller.signal });
        const saved = await upload.json() as { error?: string; url: string };
        if (!upload.ok) throw new Error(saved.error || 'Could not save the video. Please try again.');
        setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', text: result.message, video: { url: saved.url, plan: result.plan! } }]);
      }
    } catch (error) {
      setMessages(m => [...m, { id: crypto.randomUUID(), role: 'assistant', error: true, text: controller.signal.aborted ? 'Stopped. Send another message whenever you’re ready.' : error instanceof Error ? error.message : 'Could not finish this cut. Please try again.' }]);
    } finally { void audio?.close(); setBusy(false); cancel.current = null; input.current?.focus(); }
  }
  async function copy(url: string) { try { await navigator.clipboard.writeText(new URL(url, location.origin).href); setCopied(url); setTimeout(() => setCopied(''), 2000); } catch { window.prompt('Copy your video link', new URL(url, location.origin).href); } }
  return <main className="studio">
    <header className="topbar"><a href="/" className="brand" aria-label="Cut home"><span className="brand-mark"><Scissors size={21} strokeWidth={2.5}/></span>cut<span className="brand-dot">.</span></a><span className="header-note">A little chat. A great little video.</span><span className="beta">THE UGC STUDIO</span></header>
    <section className={`conversation ${messages.length ? 'has-messages' : ''}`} aria-label="Video creation chat">
      {!messages.length && <div className="welcome"><div className="welcome-kicker"><span/> FROM PRODUCT TO POST</div><h1>Got a link?<br/>Let’s make it <span>move.</span></h1><p>Tell me what you’re building. I’ll turn it into a short video<br className="desktop-break"/> with bold captions, a beat, and the perfect reaction GIF.</p><div className="ingredient-strip" aria-label="Video ingredients"><span><Film size={15}/> Real visuals</span><i>+</i><span className="type-ingredient">Aa <b>Big energy</b></span><i>+</i><span><Music2 size={15}/> A good beat</span><i>+</i><span><img src="/assets/mind-blown.gif" width="26" height="26" alt=""/> The reaction</span></div></div>}
      <div className="messages" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map(message => <article className={`message ${message.role}`} key={message.id}>{message.role === 'assistant' && <span className="avatar"><Scissors size={17}/></span>}<div className="message-content">{message.role === 'assistant' && <span className="sender">Cut</span>}<p className={message.error ? 'error-copy' : ''}>{message.text}</p>
          {message.error && !message.text.startsWith('Stopped') && <button className="retry" disabled={busy} onClick={() => send(lastPrompt)}>Try again <ArrowUpRight size={14}/></button>}
          {message.video && <div className="video-card"><div className="video-wrap"><video controls playsInline preload="metadata" src={message.video.url} aria-label={`${message.video.plan.product} marketing video`}/><span className="video-badge">YOUR FRESH CUT</span></div><div className="video-info"><span className="ready"><Check size={13}/> Ready to share</span><h2>{message.video.plan.product}</h2><p>8 seconds <span>·</span> 9:16 vertical <span>·</span> Sound on</p><div className="video-actions"><a className="download" href={`${message.video.url}?download=1`} download><Download size={15}/> Download</a><button onClick={() => copy(message.video!.url)}>{copied === message.video.url ? <Check size={15}/> : <Copy size={15}/>} {copied === message.video.url ? 'Copied' : 'Copy link'}</button></div><a className="open-video" href={message.video.url} target="_blank" rel="noreferrer">Open video <ArrowUpRight size={13}/></a><details><summary>What’s in this cut</summary><p>{message.video.plan.description}</p>{message.video.plan.credits.map(credit => <a key={credit.url} href={credit.url} target="_blank" rel="noreferrer">{credit.label} <ArrowUpRight size={11}/></a>)}</details></div></div>}
        </div></article>)}
        {busy && <article className="message assistant"><span className="avatar"><Scissors size={17}/></span><div className="message-content working"><span className="sender">Cut</span><p><LoaderCircle className="spin" size={15}/>{status}</p>{progress > 0 && <><Progress value={progress} className="render-progress"/><span className="render-note">Keep this tab open while your video comes together.</span></>}</div></article>}
      </div><div ref={end}/>
    </section>
    <div className="composer-dock"><div className="composer-inner">{!messages.length && <div className="suggestions"><span>TRY A FIRST CUT</span><button onClick={() => send("I'm building CalAI, a calorie-tracking app. Here's the site: calai.app")}>calai.app <ArrowUpRight size={13}/></button><button onClick={() => { setDraft("I'm building "); input.current?.focus(); }}>My own product <ArrowUpRight size={13}/></button><button onClick={() => send('What can you do?')}>What can you do?</button></div>}
      <form onSubmit={e => { e.preventDefault(); send(); }} className="composer"><label className="sr-only" htmlFor="message">Message Cut</label><textarea ref={input} id="message" value={draft} maxLength={2400} onChange={e => setDraft(e.target.value)} placeholder="Drop a product link, or just say hi…" rows={2} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}/><div className="composer-bottom"><span><span className="status-dot"/> Your next video starts here</span>{busy ? <button type="button" className="send stop" onClick={() => cancel.current?.abort()} aria-label="Stop rendering"><X size={19}/></button> : <button type="submit" className="send" disabled={!draft.trim()} aria-label="Send message"><ArrowUp size={20}/></button>}</div></form><div className="below-composer"><span>Real assets. Cleverly assembled.</span><span>5–10 seconds of main-character energy.</span></div>
    </div></div><footer className="studio-footer"><span>MADE FOR YOUR NEXT BIG THING</span><span>✳</span><span>SMALL CUT. BIG REACTION.</span></footer>
  </main>;
}
