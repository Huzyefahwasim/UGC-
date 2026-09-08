# Walkthrough script — target 3 minutes, under 5 minutes

Record this yourself with your camera ON, using Loom or a screen recorder with a webcam bubble. The final recording must be under five minutes. This script is a preparation aid, not a substitute for that recording.

Before recording, complete [VERCEL.md](VERCEL.md), connect both Higgsfield API credentials and the separate chat provider key, and verify a real paid generation. No credentialed Higgsfield generation has been verified in this repository yet. The local legacy-renderer demos do not establish that the new provider path works end to end.

0:00–0:20 — Open the public live link in a signed-out/incognito window. Show the camera bubble and enter the studio generation access code. “This is Cut: send a product link in chat, and it turns the brief into a short UGC-style video using Higgsfield.” Give intended reviewers the studio code separately so they can try it themselves.

0:20–0:40 — Type “hi”, then “what can you do?” Show that ordinary conversation does not start a render.

0:40–1:20 — Paste a real product URL you have not tried before, with a one-sentence description. Show the generation brief and queued/processing state. “The app reads the product page, writes a video brief, and submits it to Higgsfield. It checks for completion and returns the video here.”

Generation time depends on the provider. If necessary, pause the recorder while the job processes and say that the wait was cut when recording resumes. Keep the final recording under five minutes; do not imply the displayed video duration is the generation time.

1:20–1:55 — Play the finished video and show what this particular model actually produced. Open its output link in another tab and demonstrate downloading it. Do not promise a separate GIF layer, readable generated lettering, audio, or permanent hosting unless that result has been verified.

1:55–2:25 — Ask a normal follow-up about the product. If you demonstrate a creative revision, explain that it submits another generation and successful output uses more provider credits. Show that ordinary questions remain in chat.

2:25–3:00 — Open the public GitHub repository. Show CAPTURE-TEST.md and .agent-logs/ in the commit history. “Capture was tested in two real sessions before implementation, and logs were committed alongside the work.” Mention that Higgsfield is now the main engine; the earlier stock-asset canvas renderer remains in the codebase.

Keep credentials out of the recording. The chat API key and Higgsfield credentials are separate. Do not call the no-key conversational fallback a language model or claim that remote generation is free.

Paste the actual recorded video URL in the submission's walkthrough field. Paste the live URL and public repository URL separately in the links field, clearly labeled.

Live: use your new Vercel production URL after completing VERCEL.md. The former ChatGPT deployment was removed.

Public repository: https://github.com/Huzyefahwasim/UGC-

The deployment, credentialed provider verification, and camera-on recording still need to be completed before submission.
