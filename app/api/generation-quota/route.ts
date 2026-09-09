import { getGenerationQuota } from '../../../lib/generation-quota.ts';
import { RequestError } from '../../../lib/server.ts';
import { WAN_REQUIRED_SECONDS } from '../../../lib/wan-config.ts';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const required =
      new URL(request.url).searchParams.get('engine') === 'ltx'
        ? 120
        : WAN_REQUIRED_SECONDS;
    return Response.json(await getGenerationQuota(required), { headers });
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
