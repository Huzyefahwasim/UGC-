import { prepareGenerationRetry } from '@/lib/generation-retry';
import { RequestError } from '@/lib/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    )
      throw new RequestError('Please retry videos from the studio.', 403);
    const { id } = await context.params;
    const result = await prepareGenerationRetry(
      id,
      request.headers.get('x-generation-ticket') || '',
      () => {},
    );
    return Response.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : 'Could not prepare another attempt. Please try again in a moment.',
      },
      { status: error instanceof RequestError ? error.status : 503 },
    );
  }
}
