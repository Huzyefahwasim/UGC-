# Verification evidence

## Vercel production verified — 2026-09-09

- Live app: https://ugc-puce.vercel.app, owner’s Hobby project ugc. Public Blob store ugc-videos connected using UGC_READ_WRITE_TOKEN; production settings use UGC_ prefixes. No purchase or paid upgrade performed.
- Anonymous health request returned HTTP 200 with Gemini, signing, access and Blob configured.
- Real browser greeting returned conversation only. Submitted https://linear.app without image input; the app created and saved the video in chat.
- Public video: https://ugc-puce.vercel.app/api/videos/636dfee5-1341-4931-8dfe-6698b27c9672
- Independent unauthenticated FFprobe: 8.019300 seconds, H.264/AAC, 720 × 1280, 3,227,671 bytes.
- Production configuration change passed 131 tests, lint, TypeScript and build. Camera-on recording remains outstanding.


> Historical deployment note (superseded by the production verification above): the user reported deleting the former ChatGPT Site. URLs in the earlier evidence below are historical and are not the current deliverable. The app is being prepared for user-managed Vercel hosting; no Vercel production deployment has been performed.

## Current asset assembly — 2026-09-09

- New product messages assemble a photo, animated captions, music and a contextual GIF without GPU requests.
- Real browser test: sent only cherrytreesolution.com and received a finished video without a follow-up question. Local output: /api/videos/e550fa40-c41d-4cf1-9ffa-aec8e1d91ce0. This is not a production URL.
- FFprobe: 8.018967 seconds, H.264/AAC, 720 × 1280, 3,288,996 bytes. Chat supplied playback, download and open-video links.
- Functional checkpoint 5a7f97d: 131 tests, type checking, lint and production build passed.
- Limitations: illustrative category photos, no verified trending-audio feed, live deployment and camera-on recording outstanding.

## Historical checkpoints

Everything below describes earlier implementations. Image uploads, GPU instructions and older test counts do not describe the current default. Original agent logs are preserved as historical records.

## Wan 2.2 reference-image engine — 2026-09-09

- User selected Wan 2.2 with reference images. The inspected 5B demo was in RUNTIME_ERROR; the selected running community Space is dream2589632147/Dream-wan2-2-faster-Pro, revision a8f5e6db975eb1c427eff6f41db8f38dc20be23e. Its public API and source confirm Wan2.2-I2V-A14B, Lightx2v acceleration, a nine-argument image-to-video endpoint and direct FileData output. This is a community demo, not an official Wan API.
- Added composer image attachment with cropped preview and public-demo disclosure. Raster validation, pixel bounds, re-encoding and metadata stripping precede upload to the fixed Space. The signed brief retains the validated reference; stock references are explicitly labeled. Existing signed LTX jobs and completed results keep their original engine.
- Quota checks are recipe-specific: Wan 480 × 704 / five seconds / four steps currently reserves 45 seconds; legacy LTX retains 120 seconds. Missing/unknown quota still cannot manufacture an exhaustion error. No paid API or automatic provider fallback was introduced.
- Real browser test: attached the licensed local food reference through the file chooser and requested a CalAI video using https://calai.app. Gemini created the brief, the reference uploaded, Wan generated footage, and the normal browser compositor saved /api/videos/5549cd83-de1c-4c48-b518-aa14522d8c97. Generation job: 3893f402-e57f-40ee-8aa1-b89ea7a96b13. No fixture or reused footage was used. Quota decreased from 118.182584 to 71.404714 seconds.
- FFprobe: H.264/AAC, 720 × 1280, 5.975833 seconds, 2,361,602 bytes. Inspected three frames showing the preserved meal reference, three caption beats and animated target GIF. Attribution identifies Wan and the uploaded reference. Reload preserved the video; mobile 390 × 844 review confirmed a fitting composer and no horizontal overflow. Artifacts: .artifacts/wan-calai.mp4 and wan-calai-contact.png.
- 129 tests passed, including reference image normalization/rejection, fixed destinations, correct request shape, no automatic retry, media validation, legacy playback and 45/120-second quota boundaries. Lint, TypeScript and production build passed. The model runs remotely, not on the user's laptop or Vercel GPU. Reference links are temporary and the community demo has no uptime guarantee.

## Quota diagnosis and failed-job recovery — 2026-09-08

- Investigated the reported Cherry Tree Solutions failure. The token is configured. The official authenticated read-only quota endpoint returned 118.182584 GPU seconds; the Space reserves 120 seconds for clips up to seven seconds. Reported reset: September 9, about 21:16 Pakistan time. This establishes insufficient reservation allowance, rather than guessing from Gradio's empty error event.
- Added bounded quota inspection before provider submission, protected/no-store quota status, localized reset information, and an explicit saved-brief retry. A signed failed parent deterministically maps to one child, preserving the exact plan and preventing duplicate GPU work after a lost response. Active/completed jobs cannot start another attempt through this endpoint.
- Browser test of the same public URL: one transient Gemini failure, then a successful brief. Job 13e0030e-aa2d-4562-8333-9225afc3111a stopped at quota preflight, before provider submission. The recovery card showed 118/120 seconds and the localized reset; Retry footage was disabled. Checking availability and reloading preserved the failed brief without resubmission.
- Chose the stock option in an isolated test conversation. Normal fallback/compositor/upload produced /api/videos/91bf9ab5-8608-4fbc-b5bb-f68c14ac8bd4, clearly labeled as a stock-asset cut. FFprobe: H.264/AAC, 720 × 1280, 8.020533 seconds, 3,268,919 bytes. Browser inspection confirmed captions, a relevant animated target reaction, and download/open links. Local artifact: .artifacts/cherry-stock-recovery.mp4.
- 122 automated tests, lint, TypeScript and production build passed. Tests cover the exact 120-second boundary, depleted runs, unknown/malformed quota, safe errors, studio authorization, repeated/concurrent retry IDs, signed brief preservation and rejection of active/completed/tampered/expired parents. Production output contains the two intended endpoints and no QA routes. Twelve production traces contained no .env, .data, .agent-logs or .artifacts entries.
- AI footage cannot be retested until the free allowance recovers. No new video provider submission, paid-provider switch, billing change or deployment was performed for this fix.

## Context, reactions and studio polish — 2026-09-08

- Added 11 allowlisted Google Noto GIF reactions selected from product use context and tone. Calm mental-wellness briefs reject inappropriate shocked/party reactions. Explicit emoji revisions retain unrelated captions and scene details.
- Added licensed Relax Beat for calm/thoughtful concepts; normalized the quiet intro and restrained reaction motion. Calm captions are smaller and placed higher to leave the creator's face visible.
- Removed routine engine/GPU/shared-queue labels and technical footer. Creative brief and asset/AI disclosures remain in expandable details. Revised hero, composer, result cards, and generation progress with contextual emoji.
- Browser review: 390 × 844 mobile layout has no horizontal overflow and composer fits within the viewport. Actual sidebar layout reviewed. Motion remains pausable and reduced-motion CSS is retained.
- Real Headspace URL request completed from Gemini brief through LTX and the normal browser compositor to local storage, choosing calm reaction and Relax Beat. Output /api/videos/1a85d05b-f7ad-4546-9842-11f2bb396b17 was H.264/AAC, 720 × 1280, 6.006367 seconds.
- Inspection prompted smaller/higher captions and louder calm audio. Reused that same real raw footage in a temporary QA page to verify only the final compositor refinements, without another provider generation. Final review output /api/videos/ab8a6797-2e1e-4d72-b285-12b5c436eb07: 6.015167 seconds, H.264/AAC 720 × 1280, 1,952,870 bytes. Audio mean -26.0 dB and peak -12.9 dB. Three-frame inspection confirmed a visible face, changing captions and animated calm emoji. Review artifacts are ignored under .artifacts/headspace-refined.mp4 and headspace-refined-contact.png. The temporary QA route was removed before the final build.

- Final checks: 85 automated tests, lint and production build passed. The local developer badge was also disabled using Next.js documented devIndicators setting. No provider generation was needed for the final caption/audio refinement.

## Gemini and authenticated LTX local test — 2026-09-08

- Both server credentials are configured; neither key is exposed in the health response. Google accepted the Gemini key for model listing; Hugging Face requests now use the owner's token.
- Gemini 3.8 Flash returned 503/timeouts. Google rejected 2.5 Flash for new users and recommended 3.6 Flash. Verified 3.6 with real requests and selected it as the default.
- Moved Gemini to Google's native generateContent API, with server-side key headers, separate system instructions, user/model conversation turns, JSON output, and low thinking. Legacy OpenAI remains explicit opt-in. Native parsing excludes thought parts and rejects incomplete/blocked responses.
- The browser greeting returned a real Gemini reply without rendering a video. Two subsequent product attempts received transient 503 errors. These are now described as service unavailability rather than a model-configuration error.
- A fresh conversation successfully processed https://www.headspace.com/ through Gemini → signed brief → authenticated LTX → browser composition → local upload → finished chat video. No fixture or previously generated footage was used for this run.
- Finished video: /api/videos/c9a94391-bd6d-4ebf-bbb8-6f131f6c9b8f. FFprobe: 5.9995 seconds, H.264 720 × 1280, AAC, 2,324,722 bytes. Audio mean -23.5 dB, maximum -4.1 dB. Browser readyState 4. Byte-range request returned 206 with the requested 1,024 bytes.
- Inspected three frames: meditation footage, three changing captions, animated reaction GIF and product CTA were present. Local review artifacts are ignored under .artifacts/headspace-finished.mp4 and headspace-contact.png.
- 75 automated tests, lint and production build passed. Ten production traces contained no .env, .data or .agent-logs entries. Google service availability remains intermittent; this successful run is not an uptime guarantee.
- App remains local at http://localhost:3000/; no deployment or paid-plan change was performed.

## Current engine: LTX-Video — 2026-09-08

The owner selected the official Lightricks LTX-Video 0.9.8 13B distilled Space to replace Higgsfield. The historical sections below describe earlier versions.

- The real anonymous provider test succeeded in **22 seconds**. It generated six-second portrait plant-care footage using the product-specific director, 576 × 1024 inputs, distilled CFG 1 and multi-scale texture enhancement. No video API key or paid provider was used.
- A new product URL, `https://www.bluebottlecoffee.com/`, was sent through the real chat UI. Product metadata and its directed brief were prepared, but the next anonymous LTX request returned a Gradio error. The simple API returned no exact reason; quota exhaustion or free GPU availability is possible, not established.
- The user explicitly selected the free-asset fallback. It composed and saved an eight-second video for Blue Bottle Coffee: local path `/api/videos/e37cd536-de29-420f-bb8e-f3e7f0a6e4e1`.
- The already generated **real LTX footage** was finished in a temporary local QA page. FFprobe measured H.264 at 720 × 1280, AAC audio, 6.008833 seconds and 2,378,213 bytes. Audio mean -23.6 dB, peak -3.6 dB. A three-frame contact sheet showed moving footage, three caption beats, changing GIF frames and branding. The export is upscaled, not native 720p generation.
- A saved-result fixture reused that same real footage to exercise the normal app's resume → status → finishing → upload → video-in-chat path **without another GPU submission**. Result: `/api/videos/b1b63deb-6a1c-4c53-868d-c392a2cf8eb0`. Reload retained the result; browser playback reported 720 × 1280, 6.0103 seconds and readyState 4. The fixture was removed before the production build.
- Final local sample: ignored `.artifacts/ltx-bloom-finished.mp4`. The app clearly labels AI footage and separately credits the GIF/music.
- Greetings and capability questions returned normal chat responses with no generation plan.
- **69 automated tests passed**, covering provider SSE parsing, failure sanitization, fixed media destinations, no retry on quota rejection, shot compilation, signed tickets, encrypted records, concurrent duplicate claims and existing upload/URL protections.
- TypeScript, strict lint and the production build passed. Production routes contain no QA endpoint. Twelve production file traces were checked; none include `.env`, `.data`, `.artifacts`, `.agent-logs` or the temporary QA route.
- No Vercel deployment was performed. The user is preparing a Hugging Face token; it and the optional chat-provider key were still empty at this verification checkpoint.

Still to verify: a fresh product URL completing one uninterrupted real-provider run after the free account token is saved; fully AI-written conversation/direction after connecting the chat provider; actual Vercel Blob operations and signed-out public access on the user's deployment. The camera-on walkthrough remains user-recorded.


## Higgsfield engine and creator studio — 2026-09-08

The user explicitly selected Higgsfield as the main video engine, superseding the original stock-only requirement. The active chat now submits remote generations instead of automatically invoking the legacy canvas renderer.

- Reviewed Higgsfield's Marketing Studio, official API schema, Cinema Studio engineering account, and motion-design explanation. Their full website template workflow is not claimed to be exposed by this integration.
- Added server-only Higgsfield key ID/secret authentication and the documented `veo3.1/fast` request for eight seconds, 720p, 9:16, and native audio. The separate chat provider key remains optional for basic conversation and necessary for unrestricted AI conversation.
- Added signed 24-hour generation tickets, immutable atomic submission claims, encrypted job records, separate status polling, a production studio access code, and session recovery. Persistence retries never resubmit a paid generation. A confirmed provider ID is retained in recovery text when the tracking record cannot be saved.
- Redesigned the interface with a dark creator-studio palette, animated concept previews, kinetic captions, camera movement, hover/focus feedback, rendering stages, and reduced-motion support. The concept previews are explicitly labeled as not generated results.
- `npm test`: 75 tests passed. Provider tests use mocked official responses; none spend credits. Coverage includes concurrent claims, credential failures, malformed provider responses, encrypted storage, expiry/tampering, and persistence failure after provider acceptance.
- `npm run typecheck`, `npm run lint`, and `npm run build` passed. Production output traces contain zero `.env`, `.data`, `.agent-logs`, or `.artifacts` files.
- Browser checks at 1280 × 720: no horizontal overflow; preview pause switches animated GIFs to static frames; greeting and capability questions remain normal chat; a text-only Orbit introduction reports the missing Higgsfield connection and does not render.
- Both Higgsfield credential fields and the chat API key are empty. No Higgsfield account was accessed, no paid generation was submitted, and no new video from the live provider has been verified. No Vercel deployment was made.

Remaining validation: connect the user's own funded Higgsfield Cloud API credentials, perform one real generation, assess relevance/motion/audio, verify reload recovery against the provider, and test the user's Vercel deployment. Provider output links are temporary and are not automatically archived into Blob. The user must record the camera-on walkthrough.

## Vercel preparation and improvements — 2026-09-08

- Source checkpoint: `3637af8`, pushed to the user's existing public GitHub repository. No Vercel account was accessed and no deployment was created.
- Replaced Vinext/Cloudflare/Sites runtime configuration with Next.js 16.3.4 and Vercel Blob support. Removed the deleted Site's hosting manifest. Local development uses `.data/`; production refuses ephemeral disk fallback.
- `npm test`: 40 tests passed. TypeScript and scoped strict lint passed. `npm run build` succeeded without warnings. Production dependency audit found zero vulnerabilities.
- Production output traces were checked: zero local `.data`, `.env`, `.artifacts`, or `.agent-logs` files are included in the server artifact. Public prompt/response logs remain in the GitHub repository as requested.
- Browser greeting test returned a normal response and no render. Reload retained the conversation. New chat cleared the session's visible history.
- A text-only Bloom introduction rendered end to end. Export: H.264 at 720 × 1280 with AAC, 8.020900 seconds, 2,990,662 bytes. Audio mean -23.0 dB, peak -3.8 dB.
- Exact hook revision `Change the hook to "Your plants have a new plus-one."` rendered another video. The result's caption details retained the original benefit and closing caption.
- HTTP integration check: a new Bloom product after a CalAI previous plan returned an empty product URL, confirming that the old product website is not inherited.
- Fresh URL browser test: `Can you make a video for https://linear.app?` read real page metadata and rendered successfully. Large HTML pages retain a safe capped prefix instead of failing solely due to page size.
- Linear result: `/api/videos/90ab5aab-089c-4f60-8030-6774a120ccab` on the local preview. Export: H.264 at 720 × 1280 with AAC, 8.020400 seconds, 3,184,121 bytes. A three-frame contact sheet showed relevant captions, changing reaction GIF frames, background movement, product URL and attribution.
- The local preview was bound to `127.0.0.1`. No public hosting was started.

Remaining checks require the user's deployment credentials: actual Vercel Blob storage operations, public Vercel access, and full AI conversation using a connected provider. Blob delivery behavior is covered by isolated tests, not a claimed production deployment. The camera-on walkthrough also remains user-recorded.

## Capture

- Two real independent Codex sessions, with verbatim canary prompts and final answers in .agent-logs/.
- CAPTURE-TEST.md committed before application source (b40b3cf).
- Application checkpoint and updated logs committed together (c765d43).

## Automated checks

- Seven product/asset tests passed: URL parsing, private-address blocking, DNS address validation, metadata extraction, category asset availability, multi-frame GIF decoding, and category word-boundary regression.
- TypeScript check passed after adding explicit response types and enabling type-only TS test imports.
- Production build succeeded.
- npm audit reported zero vulnerabilities after compatible dependency upgrades.

## Local end-to-end browser test

- “hi” returned a greeting with no video render.
- CalAI message: “I'm building CalAI, a calorie-tracking app. Here's the site: calai.app”.
- Website read, media composed, and video uploaded to local R2 emulator; returned MP4 in the chat.
- Returned path: /api/videos/6e3c9af5-04a8-416b-ab29-75e58c5ab008.mp4.
- FFprobe: H.264 video, 540 × 960, AAC audio; duration 7.964733 seconds; 1,223,003 bytes.
- FFmpeg audio analysis: mean -23.0 dB, maximum -3.8 dB; not a silent audio stream.
- Inspected a three-frame contact sheet showing background, reaction GIF and changing captions. A narrow label was widened afterward.

## Still to verify

- Full AI conversation and revisions after provider key is connected.
- User-recorded camera-on walkthrough under five minutes.

## Public deployment and first fresh-URL test

- Live site: https://ugc-cut-huzyefah.jeremy767623.chatgpt.site
- A cookie-free HTTPS request returned 200 and the actual app HTML; no sign-in redirect.
- First previously untested URL: https://bear.app, sent through the live chat UI.
- Uploaded video: /api/videos/4ff3a692-9a19-456b-974c-a0e0353453a5.mp4.
- Cookie-free video download succeeded. FFprobe measured 8.006733 seconds, H.264 at 540 × 960, AAC, 1,228,237 bytes.
- Audio mean -23.0 dB and peak -3.6 dB.
- Upload without a render ticket returned 403. Byte-range retrieval returned 206 and the requested 1,024 bytes.
- Visual inspection caught a category bug: substring matching of `eat` in `create` incorrectly picked food for a notes app. Matching now uses word boundaries and prioritizes the user's description plus product metadata. Added a regression test; all seven tests passed. Local readback now selects productivity.jpg and mind-blown.gif for Bear.
- WebMCP draft_chat_message was exercised with a valid product prompt and rejected an empty prompt without changing the chat.
- GitHub API confirmed isPrivate=false and listed the three capture session files.

## Second deployment: fresh Excalidraw test

- Deployment appgdep_6a9fe304ee2c8191b65f6f31ca52dbf6 succeeded with source commit 052e2cd7cc44f964bbdc7af67703041a56136d25.
- Submitted a previously untested product through the public chat UI: "I'm building Excalidraw, a collaborative drawing app. Here's the site: https://excalidraw.com".
- Public result: https://ugc-cut-huzyefah.jeremy767623.chatgpt.site/api/videos/ce922fbc-00f5-476f-9f46-34afebb65c21.mp4.
- Cookie-free download succeeded. FFprobe measured 8.011767 seconds, H.264 at 540 × 960, AAC audio, and 1,227,747 bytes.
- Visual inspection of three extracted frames confirmed the workspace photo, relevant hook/benefit/CTA captions, changing reaction GIF frames, product name, URL, and attribution.
- The live health endpoint reported storage configured and AI not configured. This test used the documented fallback product planner.

## Capture publication boundary

A proposed background auto-push of future log entries was rejected by automatic approval review because future user prompts might contain sensitive information. That proposed feature was removed before execution. Capture remains automatic; known, reviewed logs are committed at explicit checkpoints. The final response of an ongoing turn can only be captured after it is emitted, so that last entry may be local until the next reviewed checkpoint.

## OpenRouter live preflight — pending switch

The locally saved OpenRouter key was tested against nvidia/nemotron-3-ultra-550b-a55b:free with zero-price routing and no provider fallback. Three requests did not return a complete result within 65 seconds, including short greetings and explicit reasoning disabled. Authentication success was not established by these timeouts. The model catalog reports optional reasoning; the adapter now sends enabled:false instead of unsupported effort:none. Seven LLM adapter tests and lint passed. Production remains on Gemini; no paid endpoint was used.

## Requested production provider switch

Owner confirmed the Gemini key was deleted and requested switching despite the Nemotron timeouts. UGC_OPENROUTER_API_KEY was imported to Vercel and UGC_AI_PROVIDER changed to openrouter. The exact free model and zero-price restrictions remain. Earlier render tests used Gemini and do not establish Nemotron reliability.

## Provider outage recovery — 2026-09-09

Known upstream authentication, quota, timeout and malformed-output errors now fall back to the deterministic product planner. Readable product links keep rendering from website facts; greetings remain chat and unreadable products request context. The model request is bounded to 25 seconds, including body reads. Timeout messages no longer report malformed JSON. OpenRouter remains selected, with zero-price routing; no additional provider is called.

Validation: 133 tests passed, production build (including TypeScript) and lint passed. Added regression coverage for provider failures with readable and unreadable links, greetings, and unexpected application errors. Live deployment verification follows separately.

Live recovery verification: Vercel marked commit ded17ff successfully deployed. Submitted cherrytreesolution.com in the public app and received a completed export: https://ugc-puce.vercel.app/api/videos/e776535d-90bb-4a28-a104-2d8608425a42. Anonymous ffprobe confirmed 7.9525 seconds, H.264 video 720 × 1280, AAC audio, 3,198,393 bytes. This verifies the resilient assembly flow, not the remote model's availability.

## Public creation — 2026-09-09

Removed the studio access field, outgoing access headers and server-side code checks. Production no longer requires a studio code even if obsolete environment settings remain. Signed generation/upload tickets, origin validation and chat rate limits remain. All 131 current tests pass; obsolete access-gate tests were removed and quota coverage now checks public production access.

## Laguna model switch — 2026-09-09

Selected poolside/laguna-s-2.1:free using the existing OpenRouter credentials. Zero-price routing and disabled paid fallback remain. Updated model-contract test, README, environment example and Vercel guide. Direct preflight returned HTTP 429; a diagnostic response confirmed the model is temporarily rate-limited upstream. No successful Laguna completion is claimed. Historical Nemotron tests above describe previous releases.

## Nemotron 3.5 Lightning — 2026-09-09

Selected nvidia/nemotron-3.5-lightning:free with the existing OpenRouter key and zero-price routing. Direct creativeCompletion verification succeeded: conversational advice in 6.37 seconds, Cherry Tree Solutions brief in 7.19 seconds and Bloom plant-care brief in 3.04 seconds. Briefs used the actual application system instructions and returned different captions and scene directions. These were parsed model responses, not deterministic fallback output. Free endpoint availability can still vary.

Production Lightning verification returned a real conversational answer in 24.61 seconds. A product brief hit the previous 25-second limit and used templates. Raised the OpenRouter request budget to 55 seconds (within the chat route's 90-second limit) to accommodate the observed latency; other providers retain 25 seconds.
