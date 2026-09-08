# Deploy Cut on your Vercel account

Higgsfield is the main video engine. This guide sets up a deployment you control; no Vercel project, subscription, or deployment has been created automatically.

## 1. Import the repository

In Vercel, choose **Add New → Project** and import https://github.com/Huzyefahwasim/UGC-.

- Framework preset: **Next.js**
- Root directory: repository root
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: use the Next.js default
- Node.js: 22.x or newer supported by Next.js

## 2. Connect job storage

Open the project's **Storage** tab, create a **Blob** store with **Public** access, and connect it to the project. Confirm `BLOB_READ_WRITE_TOKEN` is available in the production environment. See [Vercel Blob documentation](https://vercel.com/docs/vercel-blob).

The app stores immutable generation claims and encrypted provider job references in Blob. These records prevent a repeated submission from creating another paid provider job. The generated video itself is delivered from the provider's output URL; connecting Blob does not automatically archive Higgsfield videos.

The earlier canvas renderer also uses this store for its video uploads. Local file storage is disabled in production because the serverless filesystem is ephemeral.

## 3. Configure video generation and chat

Create a key ID and matching secret in [Higgsfield Cloud](https://cloud.higgsfield.ai). Add the following server environment variables to the Vercel project, using separate preview credentials if you enable preview deployments:

| Variable                | Value                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| `HF_API_KEY_ID`         | Your Higgsfield API key ID                                                   |
| `HF_API_KEY_SECRET`     | The matching Higgsfield API secret                                           |
| `STUDIO_ACCESS_CODE`    | A strong access code you choose for visitors allowed to generate paid videos |
| `BLOB_READ_WRITE_TOKEN` | Added by the connected public Blob store                                     |
| `OPENAI_API_KEY`        | Your separate chat provider API key                                          |
| `AI_BASE_URL`           | `https://api.openai.com/v1`, or a compatible provider's base URL             |
| `AI_MODEL`              | `gpt-4.1-mini`, or the exact chat model ID from your provider                |

Higgsfield credentials and the chat provider key serve different purposes. All of these values stay server-side; do not prefix them with `NEXT_PUBLIC_`. The chat provider must support `/chat/completions` with JSON response mode. [Higgsfield authentication documentation](https://docs.higgsfield.ai/docs/authentication).

The current integration submits to `veo3.1/fast`, requesting an eight-second, 720p, 9:16 clip with generated audio. Confirm that your Higgsfield account can access that model and has API credits. Output quality and generation time still depend on the provider; no authenticated generation has been verified yet.

Production requires `STUDIO_ACCESS_CODE` before paid generation can start. The page can open without a Vercel login, but visitors need your studio code to generate. Give intended demo reviewers that code separately. The code is an access gate, not a spending cap.

Recommended: set a stable, long random `RENDER_SIGNING_SECRET`. Otherwise generation tickets and encrypted job records derive their key from `HF_API_KEY_SECRET`. Changing the effective key invalidates pending tickets and prevents the app from reading job records encrypted with the old key.

## 4. Deploy and verify

Deploy or redeploy after changing environment variables. Then verify the public production URL, not localhost:

1. Open `/api/health`. Expect `storageConfigured: true`, `storageMode: "blob"`, `generationProvider: "higgsfield"`, `generationConfigured: true`, and `aiConfigured: true`. These flags check local configuration; they do not prove the provider accepts your credentials or has credit.
2. Open the app in a signed-out/incognito window. Enter the studio generation code when prompted.
3. Send “hi” and “what can you do?”; neither should submit a generation.
4. Send a product URL you have not tried before. Confirm that the chat moves through queued/processing to a playable output. Provider generation time is longer than the requested eight-second video duration.
5. Play the result, verify its sound and product relevance, download it, and open its output link in another incognito tab.
6. If testing a revision, expect another generation request. Confirm it uses the same product and your requested creative change.

Status polling uses separate short server calls. A browser interruption does not imply that the provider stopped generating; check the existing job before submitting another. The app deliberately does not retry an ambiguous generation submission automatically, because the provider may already have accepted it.

## Cost and retention

Successful Higgsfield generations consume API credits. Model parameters affect cost; use your account's estimate/pricing rather than assuming a fixed free allowance. Hosting, Blob, and the chat provider have their own plan limits. [Higgsfield billing and retention](https://docs.higgsfield.ai/docs/concepts/billing-and-retention).

Higgsfield output is available for at least seven days and may then be removed. Download outputs you need to keep. No automatic archive or deletion policy is configured for job records. The app's per-process request backstop and studio code do not replace account spending controls or shared rate limits.

The legacy browser upload route retains a 4,000,000-byte limit, below [Vercel Functions' 4.5 MB payload limit](https://vercel.com/docs/functions/limitations). Main-engine Higgsfield output does not pass through that upload route.

## Local preview

Use `npm run dev` with the Higgsfield credentials in ignored `.env`. Without a Blob token, development stores job records in ignored `.data/`. Keep that folder and the same signing key to retain access to existing local jobs. Local generation still calls the remote Higgsfield API and uses provider credits.

A production build started with `npm start` requires production storage and the generation access code. The former ChatGPT deployment and its video URLs are not required.
