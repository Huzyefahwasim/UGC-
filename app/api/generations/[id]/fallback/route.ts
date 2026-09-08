import { verifyGenerationTicket } from '@/lib/generation-jobs';
import { createRenderTicket } from '@/lib/tickets';
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
      throw new RequestError('Please finish videos from the studio.', 403);
    const ticket = await verifyGenerationTicket(
      request.headers.get('x-generation-ticket') || '',
    );
    if (ticket.id !== (await context.params).id)
      throw new RequestError('Invalid generation.', 403);
    return Response.json({
      renderTicket: await createRenderTicket(ticket.plan.product),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : 'Could not prepare the free-asset cut.',
      },
      { status: error instanceof RequestError ? error.status : 503 },
    );
  }
}
