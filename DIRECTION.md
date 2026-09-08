# Directing LTX footage

Cut uses **LTX-Video 0.9.8 13B distilled**, not LTX-2 or a talking-avatar model. It generates silent footage; the editor adds captions, music and a GIF.

## Product context

The chat reads bounded public metadata and page text. A connected chat model receives product facts, recent conversation, previous captions and a structured shot instruction. It returns action, subject, setting, camera and lighting fields alongside factual marketing captions.

Without a chat key, a deterministic director selects concrete scenes such as coffee pouring, plant watering, a skincare still life, a simple stretch or a creator at a desk. It recognizes close-up, overhead, shallow orbit, tripod, handheld, golden hour, bright morning and moody light. Arbitrary directions require the chat model.

The compiler produces one action-first paragraph capped at 195 words. It describes one achievable action, one environment, subject appearance, camera path/end framing and consistent light. Raw user or webpage instructions are not blindly appended. Screens face away to avoid fabricated interfaces. Objects are illustrative rather than exact branded replicas; this version does not upload reference images.

## Composition

The shot leaves the top quarter and bottom fifth quiet for overlays. LTX is not asked to draw captions, logos, generate speech or cut between scenes. The negative prompt discourages flickering, warped anatomy, floating objects, lettering and jump cuts.

Generation uses 576 × 1024, six seconds, 30 FPS, random seed, distilled CFG 1 and multi-scale texture enhancement. Gradio rounds frame counts, so raw duration varies slightly. Cut maps the footage to a six-second 720 × 1280 export, adds three animated caption beats, a smaller corner reaction GIF and licensed music. The export is upscaled; the source is not native 720p.

The chosen settings and prompt improve direction but cannot guarantee exact appearance or flawless motion.

## References

- [Lightricks prompt guide](https://github.com/Lightricks/LTX-Video#-prompt-engineering): literal chronological actions in one paragraph under 200 words.
- [Official Space code](https://huggingface.co/spaces/Lightricks/ltx-video-distilled/blob/main/app.py): the exact model, input order and texture enhancement setting.
- [Higgsfield camera guide](https://higgsfield.ai/blog/ai-video-camera-control): intentional camera movement and consistent light. LTX receives prose suggestions; it does not expose Higgsfield's Cinema Studio controls.
- [HF API guide](https://huggingface.co/docs/hub/en/spaces-api-endpoints): named REST calls and account quota.
