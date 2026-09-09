# Cut

Turn a product link into an eight-second vertical marketing video, directly in chat. **AI-organized, not AI-generated:** Cut selects and assembles a background photo, animated text, music and a contextual GIF.

[Live app](https://ugc-puce.vercel.app) · [Public repository](https://github.com/Huzyefahwasim/UGC-) · [Deployment](VERCEL.md) · [Asset credits](ASSETS.md) · [Verification](VERIFICATION.md)

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

## Chat model

OpenRouter support is implemented for **NVIDIA Nemotron 3.5 Lightning (free)**:

~~~text
nvidia/nemotron-3.5-lightning:free
~~~

The model organizes product facts, copy and asset choices; it does not generate video footage. Requests use the exact model above with zero-price routing and no provider fallback. Free-endpoint quotas and availability still apply. NVIDIA logs submitted content under its endpoint terms, so use shareable product and chat text.

**Provider status:** Nemotron 3.5 Lightning is selected. Direct verification produced a conversational reply and structured briefs using the application instructions. Free endpoints remain rate-limited. If the model fails or takes longer than 120 seconds on OpenRouter, the built-in planner uses website facts; its templates can repeat captions. No Gemini or paid-model fallback is used.

## Run locally

Requires Node 22.13+ and npm.

1. Run `npm ci`.
2. Copy `.env.example` to `.env`.
3. Set `RENDER_SIGNING_SECRET` using the random-secret command in that file.
4. Set `AI_PROVIDER=openrouter` and add your `OPENROUTER_API_KEY`.
5. Run `npm run dev` and open [localhost:3000](http://localhost:3000).

Without a key for the selected provider, a limited deterministic fallback is available. Keep secrets server-side; never commit `.env` or prefix secrets with `NEXT_PUBLIC_`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `AI_PROVIDER` | Set to `openrouter` for Nemotron 3.5 Lightning; `gemini` remains the code default and `openai` is also supported |
| `OPENROUTER_API_KEY` | OpenRouter key for the exact free Nemotron 3.5 Lightning model; no separate model setting is needed |
| `GEMINI_API_KEY` | Google AI Studio key for conversation, captions and creative context |
| `GEMINI_MODEL` | Configurable; current code default is `gemini-3.6-flash` |
| `RENDER_SIGNING_SECRET` | Stable random secret for tickets and records |
| `BLOB_READ_WRITE_TOKEN` | Public Vercel Blob store for production records and exports |
| `OPENAI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | Only used with `AI_PROVIDER=openai` |
| `HUGGINGFACE_TOKEN` | Legacy Wan/LTX jobs only; unused by normal creation |

For Nemotron 3.5 Lightning, create a key in [OpenRouter](https://openrouter.ai/settings/keys). Gemini remains available with `AI_PROVIDER=gemini` and a [Google AI Studio](https://aistudio.google.com/apikey) key. Model access, quotas and charges depend on the connected account. Hosting and Blob have separate limits. No automatic paid-provider switch occurs. `/api/health` checks configuration, not remote credential validity.

Production uses `UGC_`-prefixed settings when present, including `UGC_AI_PROVIDER` and `UGC_OPENROUTER_API_KEY`. Its dedicated Blob connection uses `UGC_READ_WRITE_TOKEN`; the local `BLOB_READ_WRITE_TOKEN` setting remains supported.

## Architecture and limits

Next.js App Router, React, TypeScript and browser Canvas/MediaRecorder. Public-page reads check private networks and bound redirects and HTML size. Webpage content is untrusted data. Signed permits authorize video uploads; composition runs in the browser.

Development uses ignored `.data/`; production requires Vercel Blob and refuses ephemeral local storage. Exports are public to anyone with the URL. Uploads are capped at 4,000,000 bytes. MP4/WebM support depends on the browser. No automatic retention cleanup is configured.

Conversation and unfinished briefs are stored in the current tab's session. The per-process rate limiter is not a deployment-wide spending cap. Wan/LTX compatibility code remains for older jobs, but new product messages do not call those services or consume GPU allowance.

## Deployment and handoff

Live app: **[ugc-puce.vercel.app](https://ugc-puce.vercel.app)**, deployed in the owner’s Vercel Hobby workspace. OpenRouter and public Blob storage are configured. See [VERCEL.md](VERCEL.md).

[WALKTHROUGH.md](WALKTHROUGH.md) is a script, not a completed recording. The camera-on walkthrough under five minutes remains outstanding.

## Validation

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

Latest integration checkpoint: **131 tests passed**, with TypeScript, lint and production build passing. The deployed asset-assembly flow was tested with a real Linear product URL: an 8.02-second H.264/AAC export at 720 × 1280. The provider-recovery release also completed a production Cherry Tree Solutions export (7.95 seconds, H.264/AAC, 720 × 1280). Lightning passed direct AI-response checks; the built-in planner keeps asset assembly available during provider failures. See [VERIFICATION.md](VERIFICATION.md).

## Agent capture

[CAPTURE-TEST.md](CAPTURE-TEST.md) records capture checks completed before application code. [`.agent-logs/`](.agent-logs/) contains prompts and final responses committed at reviewed checkpoints. Historical logs preserve earlier implementations as recorded; tools, reasoning and internal agent sessions are excluded.





