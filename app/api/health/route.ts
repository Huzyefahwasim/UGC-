import { runtime } from '@/lib/server';
import { storageConfigured, storageMode } from '@/lib/storage';
export async function GET() {
  const ready = storageConfigured();
  return Response.json(
    {
      status: ready ? 'ok' : 'setup_required',
      aiConfigured: !!runtime().OPENAI_API_KEY,
      storageConfigured: ready,
      storageMode: storageMode(),
    },
    { status: ready ? 200 : 503 },
  );
}
