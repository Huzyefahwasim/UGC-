import { RequestError } from '@/lib/server';
import { findVideo, videoResponse } from '@/lib/storage';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) {
  try {
    const { id } = await params;
    const object = await findVideo(id);
    if (!object) return new Response('Video not found', { status: 404 });
    return await videoResponse(request, id, object);
  } catch (error) {
    return new Response(
      error instanceof RequestError
        ? error.message
        : 'Could not load this video.',
      { status: error instanceof RequestError ? error.status : 500 },
    );
  }
}
export async function HEAD(request: Request, context: Context) {
  const response = await GET(new Request(request, { method: 'HEAD' }), context);
  return new Response(null, {
    status: response.status,
    headers: response.headers,
  });
}
