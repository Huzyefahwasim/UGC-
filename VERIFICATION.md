# Verification evidence

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
