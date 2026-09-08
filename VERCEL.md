# Deploy Cut on your Vercel account

This guide prepares a deployment you control. No Vercel project, store, subscription, or deployment has been created automatically.

## 1. Import the repository

In Vercel, choose **Add New → Project** and import https://github.com/Huzyefahwasim/UGC-.

- Framework preset: **Next.js**
- Root directory: repository root
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: use the Next.js default
- Node.js: 22.x or newer supported by Next.js

## 2. Connect storage

Open the project's **Storage** tab, create a **Blob** store with **Public** access, and connect it to the project. Confirm `BLOB_READ_WRITE_TOKEN` is available in the production environment. A private Blob store will not work with this app's public video delivery.

Vercel adds the token when a store is created from or connected to a project. Never use a `NEXT_PUBLIC_` prefix for this token. See [Vercel Blob documentation](https://vercel.com/docs/vercel-blob).

## 3. Configure the assistant

Add these server environment variables:

| Variable                | Value                                                               |
| ----------------------- | ------------------------------------------------------------------- |
| `OPENAI_API_KEY`        | Your AI provider's API key                                          |
| `AI_BASE_URL`           | `https://api.openai.com/v1`, or your compatible provider's base URL |
| `AI_MODEL`              | `gpt-4.1-mini`, or the exact model ID from your provider            |
| `BLOB_READ_WRITE_TOKEN` | Added by the connected public Blob store                            |

The provider must support `/chat/completions` with JSON response mode. Without an AI key, basic video creation and simple revisions still work, but free-form AI conversation does not.

Optional: set a long random `RENDER_SIGNING_SECRET` to sign upload permits separately from the Blob token. Changing the effective signing key invalidates pending permits; saved videos remain available.

## 4. Deploy and verify

Deploy or redeploy after changing environment variables. Then:

1. Open `/api/health`. Expect `status: "ok"`, `storageMode: "blob"`, and `aiConfigured: true` when an AI key is present.
2. Send “hi” and “what can you do?”; neither should create a video.
3. Send a product URL you have not tried before. Keep the tab visible during the roughly eight-second render.
4. Play with sound, download the file, and open the shared video link in an incognito window.
5. Ask for a hook revision and check that it still uses the same product.

## Upload and usage limits

Uploads are capped at 4,000,000 bytes, below [Vercel Functions' 4.5 MB payload limit](https://vercel.com/docs/functions/limitations). Video playback redirects to the Blob CDN. The browser targets 720p at 3 Mbps; if an encoder exceeds the upload cap, the app retains a local download instead of losing the video.

The app's 20-message-per-hour backstop is per server process. It does not replace Vercel Firewall rules or provider spending limits. Check the hosting, Blob, and AI plans you choose before a broad launch. No automatic deletion policy is configured for saved videos.

## Local preview

Use `npm run dev` without a Blob token to save videos in ignored `.data/`. Production refuses disk fallback because Vercel's function filesystem is ephemeral. Use a Blob connection when running a production build with `npm start`.

The former ChatGPT deployment and its video URLs are not required by this version.
