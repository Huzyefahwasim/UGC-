# Verification evidence

> Deployment status: the user reported deleting the former ChatGPT Site. URLs in the earlier evidence below are historical and are not the current deliverable. The app is being prepared for user-managed Vercel hosting; no Vercel production deployment has been performed.

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
