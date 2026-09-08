# Cut

A chat-first UGC video studio. Send a product link, have a normal conversation, and get an eight-second vertical video in the same thread.

## Run locally

Requires Node 22.13+ and npm.

1. `npm ci`
2. Copy `.env.example` to `.env` and set `OPENAI_API_KEY`. Optional `AI_BASE_URL` and `AI_MODEL` support compatible providers.
3. `npm run dev`
4. Open the URL printed by the server.

The key stays on the server. Local storage uses Wrangler's R2 emulator; production uses the Sites-provisioned R2 bucket. For production, configure the same environment keys as site secrets and deploy.

## How it works

- React/Vinext chat with one composer and a message thread.
- The server reads public product-page metadata and bounded visible text. It checks URL schemes, hosts, DNS addresses, redirects, timeouts and response sizes.
- An OpenAI-compatible language model chooses between conversation and rendering, understands the product, and writes a three-beat caption plan. Product-page text is treated as untrusted data.
- A small curated library supplies category photography, Google Noto animated GIFs and a Mixkit soundtrack. The model organizes existing media; it never generates media.
- The browser composites a 540 × 960 canvas with photo motion, captions, decoded GIF frames and a mixed audio track. MediaRecorder produces MP4 when supported, otherwise WebM.
- The finished bytes are uploaded with a short-lived one-use render ticket. R2 stores them; the app serves a stable public video URL with seeking and download support.

The browser needs to remain open during the eight-second render. No server-side FFmpeg service or paid rendering API is required. This keeps the first version inexpensive and removes queue latency. The app intentionally has no sign-in, billing, timeline editor, or library dashboard. Conversations last for the current page session; video URLs persist independently.

## Validation

`node --experimental-strip-types --test tests/product.test.ts`

`npx tsc --noEmit`

`npm run build`

The tests cover URL extraction, SSRF boundaries, metadata extraction, all asset paths, and genuinely animated GIFs. Browser and exported-media results are recorded in `VERIFICATION.md` after verification.

## Honest limits

Without an AI key, a small deterministic fallback handles greetings, help, thanks and readable product URLs. It is not a substitute for the full conversational model. Add a working key for the required ChatGPT-like conversation and product revisions.

The soundtrack is licensed stock music, not a verified currently trending song. The GIF library uses expressive animated emoji rather than celebrity/movie memes, keeping source and attribution clear. See `ASSETS.md` for origins and licensing. Videos made here include existing media; they do not imply endorsements by photographed people.

Anonymous usage is limited per IP per hour. The R2 counter is a lightweight, non-atomic abuse control, not a strict billing limit. Video uploads are capped at 12 MB. Production at larger scale would need atomic rate limiting, retention/cleanup jobs, a queue/worker renderer for closed-tab operation, and an actively maintained trend catalog.

## Agent capture

`CAPTURE-TEST.md` records two genuine canary sessions before app implementation. `.agent-logs/` contains raw user prompts and final responses, with UTC timestamps and model identifiers, interleaved with implementation commits. The capture watcher excludes internal approval sessions, tools and reasoning. See `scripts/capture.mjs` and `.codex/config.toml`.
