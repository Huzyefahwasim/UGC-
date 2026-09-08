# Verification evidence

## Capture

- Two real independent Codex sessions, with verbatim canary prompts and final answers in .agent-logs/.
- CAPTURE-TEST.md committed before application source (b40b3cf).
- Application checkpoint and updated logs committed together (c765d43).

## Automated checks

- Six product/asset tests passed: URL parsing, private-address blocking, DNS address validation, metadata extraction, category asset availability, multi-frame GIF decoding.
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
- Public deployed URL without sign-in.
- Fresh product URL rendered end-to-end on the deployment.
- User-recorded camera-on walkthrough under five minutes.
