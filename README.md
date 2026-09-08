# Cut

A chat interface that turns a product URL or description into an eight-second vertical video: real photography, three caption beats, licensed music, and a prominent animated reaction GIF.

Repository: https://github.com/Huzyefahwasim/UGC-

The former ChatGPT-hosted deployment has been removed. This version is prepared for **your own Vercel deployment**; it has not been published on your behalf.

## Local development

Requires Node 22.13+ and npm.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`. Add an AI provider key for full conversation, or leave it blank to try basic product rendering.
3. Run `npm run dev`.
4. Open http://localhost:3000.

With no Blob token, development stores videos and the render signing key in ignored `.data/`. No hosting account is needed for local testing. Keep this directory if you want local video links to survive restarts.

## Deploy on Vercel

See [VERCEL.md](VERCEL.md) for the complete setup. Import this GitHub repository as a Next.js project, connect a **public Vercel Blob store**, and configure your AI provider. The build command is `npm run build`. No ChatGPT Sites or Cloudflare runtime is required.

## What works

- Greetings and questions stay in chat. Product messages trigger a render.
- Product-page metadata helps choose existing media and write a brief. You can also supply the name and description if a site blocks reading.
- Videos are 720 × 1280, about eight seconds, with photo motion, animated captions, decoded GIF frames, and an audible soundtrack. MP4 is preferred; browsers without MP4 encoding use WebM.
- An immediate poster makes the result visible before playback. Download, copy a share link, or draft a punchier/playful revision.
- Exact quoted hook changes preserve the other captions. A new product does not inherit the previous product's URL.
- This tab's conversation and draft survive reloads through session storage. New chat clears that local history; closing the tab ends the session. Saved video links remain independent of chat.
- If uploading fails, the rendered video remains downloadable in the current tab.

## Architecture

Next.js App Router and React. The server reads public websites with bounded HTML, validates addresses and redirects, calls an OpenAI-compatible chat-completions provider when configured, and issues signed 15-minute render permits.

The browser composes existing assets into a canvas and records its video plus a Web Audio soundtrack. It must remain visible during rendering. No server renderer, paid video API, or generated media is required.

The upload API verifies the permit, checks the format and a 4,000,000-byte size ceiling, then writes one immutable video per permit. Vercel Blob serves public playback from its CDN. The app supplies a stable video path and downloads with the correct file extension. Local playback supports byte ranges, HEAD, and ETags.

## AI configuration

`OPENAI_API_KEY` stays on the server. `AI_BASE_URL` and `AI_MODEL` support an OpenAI-compatible provider; it must support chat completions and JSON response mode.

Without a key, basic mode supports greetings, help, thanks, product links, structured descriptions, and simple hook revisions. It is deterministic and does **not** provide full ChatGPT-like conversation. The interface labels this mode.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run lint
```

Tests cover product intent, URL/email boundaries, metadata quotation, real GIF frames, expiring/tampered tickets, duplicate uploads, size/type checks, byte ranges, downloads, and missing production storage. Exported-media evidence and verification limits are in [VERIFICATION.md](VERIFICATION.md).

## Limits

The music is licensed stock, not a verified currently trending song. The GIFs are Google Noto animations; [ASSETS.md](ASSETS.md) records sources and attribution. Videos do not imply endorsements by photographed people.

The anonymous request backstop is 20 messages per hour **per server process**. It is not a distributed usage or billing limit. Configure Vercel Firewall rules before opening a deployment to substantial traffic. Video storage has no automatic retention job; manage old videos in your Blob dashboard. Vercel/Blob and your AI provider's plan limits apply.

Local file storage is disabled in production to avoid losing uploads in ephemeral serverless storage. A production deployment without `BLOB_READ_WRITE_TOKEN` reports that setup is required.

## Agent capture

[CAPTURE-TEST.md](CAPTURE-TEST.md) records two real capture canaries completed before application source was written. `.agent-logs/` contains verbatim prompts and final responses, committed at reviewed implementation checkpoints. Capture excludes tools, reasoning, and internal agent sessions. Unattended public pushes are disabled.
