import { checkGenerationAccess } from '@/lib/generation-access';
import { verifyGenerationTicket } from '@/lib/generation-jobs';
import { startGeneration } from '@/lib/generation-service';
import { RequestError } from '@/lib/server';

export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    if (
      request.headers.get('origin') &&
      request.headers.get('origin') !== new URL(request.url).origin
    )
      throw new RequestError('Please generate videos from the studio.', 403);
    const ticket = await verifyGenerationTicket(
      request.headers.get('x-generation-ticket') || '',
    );
    const result = await startGeneration(ticket, () =>
      checkGenerationAccess(request),
    );
    return Response.json(result, { status: 202 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : 'Generation could not start. Please check the studio configuration.',
      },
      { status: error instanceof RequestError ? error.status : 503 },
    );
  }
}
