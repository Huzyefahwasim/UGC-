# Deploy Cut on your own Vercel account

The app uses LTX-Video through the free Hugging Face demo. No Vercel project or deployment has been created automatically.

1. Import https://github.com/Huzyefahwasim/UGC- as a Next.js project in your own Vercel account.
2. Use Node 22+, install with `npm ci`, build with `npm run build`.
3. Connect a **public Vercel Blob** store. Confirm `BLOB_READ_WRITE_TOKEN` is available to the deployment.
4. Set a stable random `RENDER_SIGNING_SECRET` and a private `STUDIO_ACCESS_CODE`.
5. Add `HUGGINGFACE_TOKEN` from https://huggingface.co/settings/tokens for your free account allowance. Anonymous mode is smaller and unreliable for a shared public app.
6. Set `AI_PROVIDER=gemini`, `GEMINI_API_KEY` and `GEMINI_MODEL=gemini-3.6-flash` for Gemini conversation and bespoke shot directions. Create the key in Google AI Studio. Keep your Google project on the free tier to avoid paid API usage.
7. Deploy with Fluid compute enabled. The generation route declares `maxDuration = 300`; it holds one Gradio stream with a four-minute deadline.
8. Disable Vercel Deployment Protection for the production site if it must open to signed-out reviewers. Give reviewers the studio code separately.

Higgsfield credentials are obsolete and unused. Keep all keys server-side, never in `NEXT_PUBLIC_` variables. An HF token is not a chat provider key.

## Verify after deployment

- Open the production link signed out. The page should load without a Vercel login.
- Check `/api/health` reports storage and generation configured. This checks local configuration, not live GPU availability.
- Send “hi” and “what can you do?”; neither should render.
- Enter the studio code and submit an unfamiliar product URL with a concrete camera/light preference.
- Keep the tab visible for finishing. Verify moving footage, three caption beats, music, the GIF, and a working download/share link.
- Reload and confirm the saved conversation and video remain available.
- If the free queue rejects the request, verify **Finish with stock assets** produces a clearly labeled stock-photo cut.
- Check a failed attempt displays allowance/reset information when known. **Check availability** must not create a job; **Retry footage** creates a single new attempt with the saved brief and is disabled while quota is known to be insufficient.

## Quotas and storage

A free HF account currently gets five GPU minutes/day. This model uses xlarge ZeroGPU at 2× quota consumption. Shared queues and runtime reservations can reject requests before the remaining allowance reaches zero. One server token shares its quota across all app users. No automatic switch to a paid video provider is implemented. [ZeroGPU documentation](https://huggingface.co/docs/hub/spaces-zerogpu).

The current Space reserves 120 GPU seconds for a six-second clip. The server checks the official quota endpoint before submitting. `/api/generation-quota` exposes only availability, remaining/required seconds and reset time; it requires the studio access code in production and is never cached. Failed quota lookups return unknown and do not block on an assumed limit. A retry requires studio access and a signed ticket for a failed job; a replay resolves to the same child job, so it cannot duplicate submission.

Vercel and Blob have their own allowances and billing settings. The studio code protects access, not hosting spend. Use account budget controls and deployment-wide rate limits as appropriate for your audience.

Blob stores encrypted footage references, immutable submission claims and completed video exports. It does not archive the original raw LTX MP4. Finish or download before the Space removes that temporary file. No automatic record-retention cleanup is configured.

Exports have a 4,000,000-byte upload cap, below [Vercel's 4.5 MB function payload limit](https://vercel.com/docs/functions/limitations). The current six/eight-second 3 Mbps exports fit this cap; unusually large output will be rejected. Videos are immutable and published only with signed upload permits.

## Local development

The ignored `.env` file contains your settings. Without a Blob token, development stores records and exports in ignored `.data/`. Keep the signing secret and data directory to preserve access. Production deliberately refuses to use ephemeral local disk.
