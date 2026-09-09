import { setting } from '@/lib/config';
import { runtime } from '@/lib/server';
import { storageConfigured, storageMode } from '@/lib/storage';

export async function GET() {
  const storageReady = storageConfigured();
  const generationReady = Boolean(setting('RENDER_SIGNING_SECRET'));
  const ready = storageReady && generationReady;
  return Response.json(
    {
      status: ready ? 'ok' : 'setup_required',
      aiConfigured: !!runtime().apiKey,
      aiProvider: runtime().provider,
      aiModel: runtime().model,
      generationConfigured: generationReady,
      generationProvider: 'stock',
      generationAuthenticated: true,
      generationAccessRequired: false,
      generationAccessConfigured: true,
      storageConfigured: storageReady,
      storageMode: storageMode(),
    },
    { status: ready ? 200 : 503 },
  );
}
