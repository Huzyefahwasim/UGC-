import { readGeneration, verifyGenerationTicket } from '@/lib/generation-jobs';
import { getVideoStatus } from '@/lib/higgsfield';
import { RequestError } from '@/lib/server';

export const maxDuration = 90;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const ticket = await verifyGenerationTicket(
      request.headers.get('x-generation-ticket') || '',
    );
    if (ticket.id !== id)
      throw new RequestError('This generation link is invalid.', 403);
    const job = await readGeneration(id);
    if (job.error) return Response.json({ status: 'failed', error: job.error });
    if (!job.providerId)
      return Response.json({
        status: job.claimed ? 'submitting' : 'not_started',
      });
    const result = await getVideoStatus(job.providerId);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : 'Could not check the generation. Please resume in a moment.',
      },
      { status: error instanceof RequestError ? error.status : 503 },
    );
  }
}
