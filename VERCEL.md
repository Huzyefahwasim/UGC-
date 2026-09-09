# Deploy Cut on Vercel

Normal creation assembles licensed assets in the browser. It requires no GPU, Hugging Face token or video-generation service. No production deployment has been verified.

## Setup

1. Import [Huzyefahwasim/UGC-](https://github.com/Huzyefahwasim/UGC-) as a Next.js project in your Vercel account.
2. Choose a supported Node version satisfying 22.13+. Install with `npm ci`, build with `npm run build`.
3. Connect a **public Vercel Blob** store and expose `BLOB_READ_WRITE_TOKEN` to the deployment.
4. Set a stable random `RENDER_SIGNING_SECRET` and a private `STUDIO_ACCESS_CODE`.
5. Set `AI_PROVIDER=gemini`, `GEMINI_API_KEY` and an accessible `GEMINI_MODEL`. The code default is `gemini-3.6-flash`; account model access must be checked.
6. Deploy. The chat route declares a 90-second maximum; ensure your runtime supports its configuration. Normal composition runs in the browser.
7. Configure deployment protection so intended signed-out reviewers can open the page. Share the studio code separately.

Keep keys server-side and out of Git. Provider, hosting and storage charges depend on account settings. No automatic paid-provider switch is implemented.

## Verify after deployment

- Open the site signed out and check `/api/health` reports ready. This checks configuration, not remote keys.
- Send “hi” and “what can you do?”; neither should render.
- Enter the studio code and send an unfamiliar readable product URL without an image.
- Keep the tab visible. Check all four layers in the eight-second result: photo, animated text, music and GIF.
- Play the saved URL, download the file and reload the chat.
- Confirm a question about a product URL stays conversational.

## Storage and limits

Local development uses ignored `.data/` without a Blob token. Production refuses ephemeral local storage. Preserve the signing secret and records for existing tickets and results.

Exports are public to anyone with their URL, authorized by signed permits and capped at 4,000,000 bytes. Larger uploads are rejected. No automatic retention cleanup exists. Studio access does not cap account spending; the per-process rate limiter is not distributed.

Older Wan/LTX compatibility routes retain their own tokens, quotas and longer timeouts. Those are not part of new asset-assembled cuts.
