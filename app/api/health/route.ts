import { runtime } from '@/lib/server';
import { storageConfigured, storageMode } from '@/lib/storage';
import { configured, authenticated } from '@/lib/ltx';
import { generationAccessRequired } from '@/lib/generation-access';
export async function GET() {
  const storageReady = storageConfigured();
  const generationReady =
    configured() && Boolean(process.env.RENDER_SIGNING_SECRET?.trim());
  const accessReady =
    !generationAccessRequired() ||
    Boolean(process.env.STUDIO_ACCESS_CODE?.trim());
  const ready = storageReady && generationReady && accessReady;
  return Response.json(
    {
      status: ready ? 'ok' : 'setup_required',
      aiConfigured: !!runtime().apiKey,
      aiProvider: runtime().provider,
      aiModel: runtime().model,
      generationConfigured: generationReady,
      generationProvider: 'wan',
      generationAuthenticated: authenticated(),
      generationAccessRequired: generationAccessRequired(),
      generationAccessConfigured: accessReady,
      storageConfigured: storageReady,
      storageMode: storageMode(),
    },
    { status: ready ? 200 : 503 },
  );
}
