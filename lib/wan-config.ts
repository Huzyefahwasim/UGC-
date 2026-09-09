export const WAN_SPACE =
  'https://dream2589632147-dream-wan2-2-faster-pro.hf.space';
export const WAN_DEMO =
  'https://huggingface.co/spaces/dream2589632147/Dream-wan2-2-faster-Pro';
// Pinned recipe: 480x704 reference, 5 seconds at 16fps, four distilled steps.
// Current Space duration formula floors this recipe at 45s on default-size ZeroGPU.
export const WAN_REQUIRED_SECONDS = 45;
export type WanReference = { path: string; source: 'upload' | 'stock' };
export function validWanReference(value: unknown): value is WanReference {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Record<string, unknown>;
  return (
    typeof ref.path === 'string' &&
    /^\/tmp\/gradio\/[a-f0-9]{32,64}\/reference\.jpg$/.test(ref.path) &&
    (ref.source === 'upload' || ref.source === 'stock')
  );
}
export function referenceUrl(ref: WanReference) {
  return validWanReference(ref)
    ? `${WAN_SPACE}/gradio_api/file=${ref.path}`
    : '';
}
