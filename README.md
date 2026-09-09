# Cut

Turn a product link into an eight-second vertical marketing video, directly in chat. **AI-organized, not AI-generated:** Cut selects and assembles a background photo, animated text, music and a contextual GIF.

[Public repository](https://github.com/Huzyefahwasim/UGC-) · [Deployment](VERCEL.md) · [Asset credits](ASSETS.md) · [Verification](VERIFICATION.md)

## How it works

1. Say hello or ask a question for a conversational reply.
2. Send a product message such as “I'm building CalAI, a calorie-tracking app. Here's the site: calai.app”. A product URL alone also works.
3. Cut reads the public webpage and creates a factual brief, three caption beats and a matching reaction.
4. The browser assembles the video and returns playback, download and a saved link in the thread.

No image upload or video-generation API is required. Keep the tab visible during composition. Readable product messages proceed without asking for the description again; inaccessible or uninformative sites may need more detail. Questions about a URL do not automatically render.

## Four layers

| Layer | Implementation |
| --- | --- |
| Background | Licensed category photo with animated camera movement |
| Text | Animated hook, supported benefit and product CTA |
| Audio | Curated licensed music selected for mood |
| GIF | One of eleven animated reactions matched to context and tone |

Photos illustrate a category, not the exact product or a customer endorsement. Music and GIFs are curated; current trending status is not verified. See [DIRECTION.md](DIRECTION.md) and [ASSETS.md](ASSETS.md).

## Run locally

Requires Node 22.13+ and npm.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`.
3. Set `RENDER_SIGNING_SECRET` using the random-secret command in that file.
4. Add `GEMINI_API_KEY` for conversational replies and product-specific copy.
5. Run `npm run dev` and open [localhost:3000](http://localhost:3000).

Without a Gemini key, a limited deterministic fallback is available. Keep secrets server-side; never commit `.env` or prefix secrets with `NEXT_PUBLIC_`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | Defaults to `gemini`; `openai` selects the optional legacy chat integration |
| `GEMINI_API_KEY` | Google AI Studio key for conversation, captions and creative context |
| `GEMINI_MODEL` | Configurable; current code default is `gemini-3.6-flash` |
| `RENDER_SIGNING_SECRET` | Stable random secret for tickets and records |
| `STUDIO_ACCESS_CODE` | Required in production to restrict creation access |
| `BLOB_READ_WRITE_TOKEN` | Public Vercel Blob store for production records and exports |
| `OPENAI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Only used with `AI_PROVIDER=openai` |
| `HUGGINGFACE_TOKEN` | Legacy Wan/LTX jobs only; unused by normal creation |

Create a key in [Google AI Studio](https://aistudio.google.com/apikey). Model access, quotas and charges depend on the connected account. Hosting and Blob have separate limits. No automatic paid-provider switch occurs. `/api/health` checks configuration, not remote credential validity.

## Architecture and limits

Next.js App Router, React, TypeScript and browser Canvas/MediaRecorder. Public-page reads check private networks and bound redirects and HTML size. Webpage content is untrusted data. Signed permits authorize video uploads; composition runs in the browser.

Development uses ignored `.data/`; production requires Vercel Blob and refuses ephemeral local storage. Exports are public to anyone with the URL. Uploads are capped at 4,000,000 bytes. MP4/WebM support depends on the browser. No automatic retention cleanup is configured.

Conversation and unfinished briefs are stored in the current tab's session. The studio code restricts creation; the per-process rate limiter is not a deployment-wide spending cap. Wan/LTX compatibility code remains for older jobs, but new product messages do not call those services or consume GPU allowance.

## Deployment and handoff

There is **no current verified production URL**. The old ChatGPT Site was deleted. Follow [VERCEL.md](VERCEL.md) for user-managed deployment and signed-out verification.

[WALKTHROUGH.md](WALKTHROUGH.md) is a script, not a completed recording. The live deployment and camera-on walkthrough under five minutes remain outstanding.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Latest functional checkpoint: **131 tests passed**, plus a real link-only Cherry Tree Solutions export measured at 8.02 seconds, H.264/AAC, 720 × 1280. See [VERIFICATION.md](VERIFICATION.md).

## Agent capture

[CAPTURE-TEST.md](CAPTURE-TEST.md) records capture checks completed before application code. [`.agent-logs/`](.agent-logs/) contains prompts and final responses committed at reviewed checkpoints. Historical logs preserve earlier implementations as recorded; tools, reasoning and internal agent sessions are excluded.

Production connection: the ugc project uses UGC_READ_WRITE_TOKEN for its dedicated public Blob store. UGC_AI_PROVIDER, UGC_GEMINI_API_KEY, UGC_GEMINI_MODEL, UGC_RENDER_SIGNING_SECRET and UGC_STUDIO_ACCESS_CODE take precedence over their unprefixed equivalents; local configuration remains compatible.
