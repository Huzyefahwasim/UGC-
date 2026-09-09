# Directing Wan 2.2 footage

Cut uses Wan 2.2 I2V A14B through a community Hugging Face Space with Lightx2v acceleration. It generates silent footage from a reference; the browser adds animated captions, licensed music and a GIF.

## Reference first

Users supply a product link, not an image. Cut reads the page, builds a product brief and selects a licensed category stock scene internally. The server crops it to 480 × 704, strips metadata and uploads it to the fixed Space. The validated reference is included in the signed brief and reused for revisions.

The stock scene illustrates the category, rather than reproducing the actual product. References and prompts go to the public community Space.

## Context and motion

Gemini receives bounded product-page facts, conversation and previous captions. It writes product-specific hooks, benefits and CTAs, and selects a suitable animated reaction. It does not receive the reference image for visual analysis.

The motion compiler prioritizes the reference: preserve its subjects, product shape, composition, colors and setting. Product facts inform mood, not permission to add an unseen person or prop. Use a small stable camera movement and subtle motion. Calm products get restrained movement; an explicit static-camera request is honored. The ending settles for the CTA. No invented readable screens, hands, speech or branding.

The earlier LTX shot compiler remains for previously signed LTX jobs. Wan uses image-preserving motion instructions rather than imposing a text-to-video scene on the reference.

## Composition and limits

The recipe is five seconds at 16fps, four distilled steps and guidance 1/1. The Space rounds frame counts. Its 480 × 704 output is center-cropped and upscaled for a six-second 720 × 1280 edit; playback is gently slowed. This is not native 720p generation. Three caption beats, music and a contextual GIF are composed locally. The model can still distort details, and the free community demo has no uptime guarantee.

- [Wan model](https://huggingface.co/Wan-AI/Wan2.2-I2V-A14B)
- [Selected Space source](https://huggingface.co/spaces/dream2589632147/Dream-wan2-2-faster-Pro/blob/main/app.py), reviewed revision a8f5e6db975eb1c427eff6f41db8f38dc20be23e.
- [HF API guide](https://huggingface.co/docs/hub/en/spaces-api-endpoints)
