# Cut

Send a product URL and optionally attach a reference photo. Cut animates it with **Wan 2.2**, then adds captions, licensed music and a contextual GIF to return a finished vertical video.

Public repository: https://github.com/Huzyefahwasim/UGC-

The former ChatGPT Site was deleted. This version is prepared for **your own Vercel deployment**; no Vercel account or deployment has been used on your behalf.

## Run locally

Requires Node 22.13+ and npm.

1. Run `npm ci`.
2. Copy `.env.example` to ignored `.env`.
3. Generate a random `RENDER_SIGNING_SECRET` using the command in that file.
4. Optionally add a free Hugging Face read token as `HUGGINGFACE_TOKEN`.
5. Run `npm run dev` and open http://localhost:3000.

No Higgsfield credentials are used. The free community Wan demo uses a shared GPU allowance. A Hugging Face token attributes requests to your account. It is separate from the optional chat provider key.

## Video flow

- Greetings and questions stay in chat. Product introductions, URLs and explicit video requests create a brief.
- Product-page metadata, audience, use moment and user preferences inform the hook, benefit, CTA and one filmable scene. Caption-only revisions preserve the established scene.
- Eleven curated animated reactions match the product and tone: calm for meditation, thinking for learning, coffee for rituals, leaf for plant care, and others. Calm/thoughtful concepts get a quieter soundtrack, restrained motion and smaller captions above the face.
- Add a JPG, PNG or WebP reference photo. The composer previews its center crop; the server verifies and re-encodes it before uploading to Hugging Face. Without an attachment, Cut uses a clearly labeled category stock scene.
- Wan animates the reference into five-second silent footage. The browser gently slows it into a six-second vertical edit.
- The browser composites the footage with animated captions, a beat-reactive Google Noto GIF, music and a product CTA, then saves the export.
- Keep the tab visible during the six-second finishing step. A failed finish can reuse the saved footage without another GPU submission.
- If Wan rejects a request, explicitly choose **Finish with stock assets** to render an eight-second stock-photo cut. This result is clearly labeled.
- Failed jobs offer **Retry footage**, preserving the exact brief. This starts one new attempt; repeated clicks or lost responses reuse that same retry. **Check availability** only reads the allowance and never starts a video.
- Conversation and unfinished jobs survive reloads in the current tab's session.

See [DIRECTION.md](DIRECTION.md) for prompt construction and [ASSETS.md](ASSETS.md) for attribution.

## Quality and context

A connected Gemini chat provider writes bespoke shot directions from the conversation and webpage. Without it, the built-in deterministic director recognizes product contexts and camera/light preferences. It is useful for basic briefs but is not a general conversational language model.

The main engine is Wan 2.2 I2V A14B with Lightx2v acceleration: four steps, guidance 1/1 and a five-second request. The 480 × 704 reference becomes footage that is cropped and upscaled to 720 × 1280, not native 720p generation. [Selected community demo](https://huggingface.co/spaces/dream2589632147/Dream-wan2-2-faster-Pro). LTX remains for already-signed legacy jobs and saved results.

Reference images and prompts are sent to the community Space, whose temporary files and prompt history may be public. Use material suitable for sharing. Gemini supplies product facts and captions but does not visually analyze the attachment. The motion instructions prioritize the pictured subjects and setting. Stock scenes are illustrative, not real product photos.

## Server configuration

| Variable | Purpose |
| --- | --- |
| `HUGGINGFACE_TOKEN` | Optional free account token for Wan and legacy LTX quota |
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

Before a submission, the server checks GPU seconds and run allowance. The fixed Wan recipe currently reserves **45 GPU seconds** on default-size ZeroGPU; legacy LTX jobs retain their **120-second** check. Known exhaustion stops submission and shows the reset in the viewer’s timezone. Missing credentials or an unavailable quota response leave availability unknown. [Quota API](https://huggingface.co/docs/hub/en/spaces-api-endpoints#zerogpu-spaces).

Free Hugging Face accounts currently receive **five GPU minutes/day**; anonymous access has a smaller shared allowance. Switching models does not reset the account allowance. One server token shares its allowance among all users. This is processing time, not minutes of finished video. [Official quotas](https://huggingface.co/docs/hub/spaces-zerogpu).

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
