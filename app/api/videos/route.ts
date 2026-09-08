import { readLimited, RequestError } from '@/lib/server';
import { MAX_VIDEO_BYTES, saveVideo } from '@/lib/storage';
import { verifyRenderTicket } from '@/lib/tickets';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    )
      throw new RequestError('Please upload from the app.', 403);
    const permit = await verifyRenderTicket(
      request.headers.get('x-render-ticket') || '',
    );
    const type =
      request.headers.get('content-type')?.split(';')[0].trim() || '';
    if (type !== 'video/mp4' && type !== 'video/webm')
      throw new RequestError('Unsupported video format.');
    if (Number(request.headers.get('content-length')) > MAX_VIDEO_BYTES)
      throw new RequestError(
        'The video is too large. Please render it again.',
        413,
      );
    const bytes = await readLimited(request, MAX_VIDEO_BYTES);
    await saveVideo(permit.id, bytes, type);
    return Response.json({ url: `/api/videos/${permit.id}` });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : 'Could not save the video. Please try again.',
      },
      { status: error instanceof RequestError ? error.status : 500 },
    );
  }
}
