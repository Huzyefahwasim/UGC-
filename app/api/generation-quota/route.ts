import { checkGenerationAccess } from '../../../lib/generation-access.ts';
import { getGenerationQuota } from '../../../lib/generation-quota.ts';
import { RequestError } from '../../../lib/server.ts';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    checkGenerationAccess(request);
    return Response.json(await getGenerationQuota(), { headers });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RequestError
            ? error.message
            : 'Video availability could not be checked.',
      },
      { status: error instanceof RequestError ? error.status : 503, headers },
    );
  }
}
