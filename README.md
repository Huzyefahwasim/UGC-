# Cut

Send a product URL in chat. Cut directs **LTX-Video footage**, then adds animated captions, licensed music and a reaction GIF to return a finished vertical video.

Public repository: https://github.com/Huzyefahwasim/UGC-

The former ChatGPT Site was deleted. This version is prepared for **your own Vercel deployment**; no Vercel account or deployment has been used on your behalf.

## Run locally

Requires Node 22.13+ and npm.

1. Run `npm ci`.
2. Copy `.env.example` to ignored `.env`.
3. Generate a random `RENDER_SIGNING_SECRET` using the command in that file.
4. Optionally add a free Hugging Face read token as `HUGGINGFACE_TOKEN`.
5. Run `npm run dev` and open http://localhost:3000.

No Higgsfield credentials are used. Anonymous LTX access works within a small shared allowance. A Hugging Face token attributes requests to your account. It is separate from the optional chat provider key.

## Video flow

- Greetings and questions stay in chat. Product introductions, URLs and explicit video requests create a brief.
- Product-page metadata, audience, use moment and user preferences inform the hook, benefit, CTA and one filmable scene. Caption-only revisions preserve the established scene.
- Eleven curated animated reactions match the product and tone: calm for meditation, thinking for learning, coffee for rituals, leaf for plant care, and others. Calm/thoughtful concepts get a quieter soundtrack, restrained motion and smaller captions above the face.
- LTX generates one continuous six-second vertical shot. It does not generate speech, music, captions or GIFs.
- The browser composites the footage with animated captions, a beat-reactive Google Noto GIF, music and a product CTA, then saves the export.
- Keep the tab visible during the six-second finishing step. A failed finish can reuse the saved footage without another GPU submission.
- If LTX rejects a request, explicitly choose **Finish with stock assets** to render an eight-second stock-photo cut. This result is clearly labeled.
- Failed jobs offer **Retry footage**, preserving the exact brief. This starts one new attempt; repeated clicks or lost responses reuse that same retry. **Check availability** only reads the allowance and never starts a video.
- Conversation and unfinished jobs survive reloads in the current tab's session.

See [DIRECTION.md](DIRECTION.md) for prompt construction and [ASSETS.md](ASSETS.md) for attribution.

## Quality and context

A connected Gemini chat provider writes bespoke shot directions from the conversation and webpage. Without it, the built-in deterministic director recognizes product contexts and camera/light preferences. It is useful for basic briefs but is not a general conversational language model.

The main engine is the official Lightricks LTX-Video 0.9.8 13B distilled Space: 576 × 1024 generation, six seconds requested, multi-scale texture enhancement and portrait framing. Final exports are 720 × 1280; this is upscaling, not native 720p footage. The model may still produce visual artifacts. Its free demo is not guaranteed production infrastructure.

## Server configuration

| Variable | Purpose |
| --- | --- |
| `HUGGINGFACE_TOKEN` | Optional free account token for LTX quota |
| `RENDER_SIGNING_SECRET` | Required stable random secret for tickets and encrypted records |
| `STUDIO_ACCESS_CODE` | Required in production to protect the shared GPU quota |
| `BLOB_READ_WRITE_TOKEN` | Public Vercel Blob store for production records and finished videos |
| `AI_PROVIDER` | `gemini` by default; `openai` explicitly selects the legacy provider |
| `GEMINI_API_KEY` | Google AI Studio key for conversation, captions and shot direction |
| `GEMINI_MODEL` | Defaults to `gemini-3.6-flash` |
| `OPENAI_API_KEY` | Only used with `AI_PROVIDER=openai` |
| `AI_BASE_URL` | OpenAI-compatible base URL |
| `AI_MODEL` | Chat model ID |

Create a Gemini key at https://aistudio.google.com/apikey and save it as `GEMINI_API_KEY` in `.env`. Requests go directly to Google using its native generateContent API, without OpenAI credentials or billing. Free-tier quotas depend on your Google project; enabling paid billing changes costs. See [Google pricing](https://ai.google.dev/gemini-api/docs/pricing). There is no automatic provider switch on quota errors. Without a Gemini key, chat uses the basic fallback. `/api/health` reports configuration, not remote key validity.

Keep keys server-side and out of Git. Never prefix secrets with `NEXT_PUBLIC_`. Changing the signing secret invalidates existing jobs.

## Architecture and limits

Next.js App Router, React and browser Canvas/MediaRecorder. Public product URLs are resolved and checked against private networks; redirects and HTML reads are bounded. The model receives a compact visual description, not raw page instructions.

The server makes one named Gradio submission and holds one event stream until completion, bounded to four minutes. The route allows 300 seconds on Vercel. Atomic immutable claims prevent duplicate GPU submissions. Completed footage references are encrypted before saving; retries read the saved result rather than reopening a consumed Gradio stream.

Before a new submission, the server checks the authenticated account's GPU seconds and run allowance. This Space reserves **120 GPU seconds** for clips up to seven seconds, including the app's six-second shot. A remainder below 120 cannot start a clip. A known exhausted limit stops submission and the recovery card shows the provider's reset in the viewer's timezone. Missing credentials or an unavailable quota response leave availability unknown; the app does not invent a quota error. Shortening a six-second shot to five seconds would not reduce this reservation. [Quota API](https://huggingface.co/docs/hub/en/spaces-api-endpoints#zerogpu-spaces).

Free Hugging Face accounts currently receive **five GPU minutes/day**; anonymous access has a smaller shared allowance. This Space uses xlarge GPU hardware at **2× quota consumption**, with shared queues. One server token shares its allowance among all users. This is processing time, not minutes of finished video. [Official quotas](https://huggingface.co/docs/hub/spaces-zerogpu).

Finished videos are stored in local ignored `.data/` for development or Vercel Blob in production. Original Space footage links are temporary. Hosting, Blob and an optional chat provider have separate plan limits; this does not promise an entirely unlimited free service. The per-process chat rate backstop is not a distributed quota cap.

## Deploy and verify

Follow [VERCEL.md](VERCEL.md). Run:

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

[VERIFICATION.md](VERIFICATION.md) records actual checks and limitations. [WALKTHROUGH.md](WALKTHROUGH.md) is a camera-on recording script; the user must record and submit the walkthrough.

## Agent capture

[CAPTURE-TEST.md](CAPTURE-TEST.md) records two real capture canaries completed before application source was written. `.agent-logs/` contains prompts and final responses, committed at reviewed checkpoints. Tools, reasoning and internal agent sessions are excluded. Future logs are not pushed unattended.
