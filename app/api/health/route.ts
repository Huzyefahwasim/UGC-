import { setting } from '@/lib/config';
import { runtime } from '@/lib/server';
import { storageConfigured, storageMode } from '@/lib/storage';

import { generationAccessRequired } from '@/lib/generation-access';
export async function GET() {
  const storageReady = storageConfigured();
  const generationReady = Boolean(setting('RENDER_SIGNING_SECRET'));
  const accessReady =
    !generationAccessRequired() || Boolean(setting('STUDIO_ACCESS_CODE'));
  const ready = storageReady && generationReady && accessReady;
  return Response.json(
    {
      status: ready ? 'ok' : 'setup_required',
      aiConfigured: !!runtime().apiKey,
      aiProvider: runtime().provider,
      aiModel: runtime().model,
      generationConfigured: generationReady,
      generationProvider: 'stock',
      generationAuthenticated: true,
      generationAccessRequired: generationAccessRequired(),
      generationAccessConfigured: accessReady,
      storageConfigured: storageReady,
      storageMode: storageMode(),
    },
    { status: ready ? 200 : 503 },
  );
}
