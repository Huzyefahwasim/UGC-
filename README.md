# Cut

A creator studio with a chat interface: send a product URL or description, shape the brief in conversation, and generate a short UGC-style video with **Higgsfield as the main video engine**.

Repository: https://github.com/Huzyefahwasim/UGC-

The former ChatGPT-hosted deployment has been removed. This version is prepared for **your own Vercel deployment**; no Vercel account or deployment has been used on your behalf.

## Local development

Requires Node 22.13+ and npm.

1. Run `npm ci`.
2. Copy `.env.example` to the ignored `.env` file.
3. Set `HF_API_KEY_ID` and `HF_API_KEY_SECRET` from your Higgsfield Cloud account. Set the separate `OPENAI_API_KEY` for full AI conversation.
4. Run `npm run dev` and open http://localhost:3000.

Missing Higgsfield credentials are a setup requirement, not a request to use the old stock-asset renderer. Without a chat key, the deterministic conversational fallback can handle basic greetings and product requests; it is not a language model.

## Deploy on Vercel

Follow [VERCEL.md](VERCEL.md). Import this repository as a Next.js project, add your server-side provider credentials, then deploy through your own account. The build command is `npm run build`. ChatGPT Sites and Cloudflare are not required.

## Product flow

- Greetings and ordinary questions stay in chat. Product creation requests start a video job.
- Public product-page metadata helps write a specific brief. A name and description also work when a website blocks reading.
- The server submits the brief to Higgsfield. The chat follows the queued/processing state and presents the returned output when generation completes.
- Product revisions reuse the conversation and submit a new generation. A new product does not inherit the previous product's URL.
- The tab's conversation and draft survive reloads through session storage. New chat clears that history; closing the tab ends the local session.

Higgsfield is an AI media generator. This version intentionally changes the original stock-only rendering approach following the owner's request. Output quality, sound, typography, and duration depend on the selected model and parameters; a separate animated GIF layer or currently trending track is not guaranteed.

## Architecture

Next.js App Router and React. The server reads public websites with bounded HTML, validates addresses and redirects, and calls an OpenAI-compatible chat-completions provider when configured.

Video generation runs remotely through Higgsfield's asynchronous API. The current model is `veo3.1/fast`, with eight seconds, 720p, 9:16, and native audio requested. Submission and status checks use separate server requests, so a Vercel function does not stay open for the entire generation. Higgsfield credentials stay on the server. See the [official API documentation](https://docs.higgsfield.ai/docs).

Vercel Blob stores immutable submission claims and encrypted provider job references; it does not automatically copy the generated videos. Development can use ignored `.data/` for these records. Production requires Blob and a `STUDIO_ACCESS_CODE` to allow paid generation. Visitors can open the page without a hosting login, but need that code to generate.

The earlier 720p, eight-second canvas assembler remains in `lib/render.ts`, alongside its stock assets and upload/storage support. It is not the default engine or an automatic fallback for an unavailable provider. Its previously verified exports do not establish that the new Higgsfield path has been tested against a live account.

## Provider configuration

| Variable                | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| `HF_API_KEY_ID`         | Higgsfield API credential ID                                         |
| `HF_API_KEY_SECRET`     | Matching Higgsfield API secret                                       |
| `OPENAI_API_KEY`        | Separate AI provider key for conversation and briefs                 |
| `AI_BASE_URL`           | OpenAI-compatible base URL; defaults to `https://api.openai.com/v1`  |
| `AI_MODEL`              | Chat model ID; defaults to `gpt-4.1-mini`                            |
| `BLOB_READ_WRITE_TOKEN` | Public Vercel Blob store for production job records                  |
| `STUDIO_ACCESS_CODE`    | Visitor generation access code; required in production               |
| `RENDER_SIGNING_SECRET` | Optional stable key for generation tickets and encrypted job records |

Create the two Higgsfield credentials in [Higgsfield Cloud](https://cloud.higgsfield.ai). They are different from the chat provider key. Do not use a `NEXT_PUBLIC_` prefix or commit secrets. The chat provider must support chat completions with JSON response mode.

## Costs and output retention

Higgsfield charges successful generations in account credits; the cost depends on the model and parameters. Creative revisions produce new generation requests. Check your account's model pricing and spending controls before making the app public. [Higgsfield billing documentation](https://docs.higgsfield.ai/docs/concepts/billing-and-retention).

Provider output links are temporary delivery, not permanent storage. Download completed videos you need to keep. The provider documents availability for at least seven days, after which output may be removed. [Output retention](https://docs.higgsfield.ai/docs/concepts/billing-and-retention).

The app's anonymous request backstop is per server process. It is not a distributed usage or billing limit. Hosting and chat-provider plan limits also apply.

## Verification

```sh
npm test
npm run typecheck
npm run build
npm run lint
```

Verification evidence and current limits are recorded in [VERIFICATION.md](VERIFICATION.md). No authenticated Higgsfield generation has been completed yet because no API credentials have been connected. Before submission, verify a real generation from an unfamiliar product URL on your public Vercel deployment.

Bundled legacy media attribution is recorded in [ASSETS.md](ASSETS.md). [WALKTHROUGH.md](WALKTHROUGH.md) is a camera-on recording script, not a completed walkthrough.

## Agent capture

[CAPTURE-TEST.md](CAPTURE-TEST.md) records two real capture canaries completed before application source was written. `.agent-logs/` contains verbatim prompts and final responses, committed at reviewed implementation checkpoints. Capture excludes tools, reasoning, and internal agent sessions. Unattended public pushes are disabled.
