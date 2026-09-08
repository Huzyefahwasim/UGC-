import { createHash } from 'node:crypto';
import {
  createGenerationTicket,
  readGeneration,
  verifyGenerationTicket,
} from './generation-jobs.ts';
import { RequestError } from './server.ts';

function retryId(parentId: string): string {
  // Every replay of this parent, including a lost HTTP response, addresses the
  // same child. The existing atomic claim then permits only one GPU submission.
  const bytes = createHash('sha256')
    .update(`cut-ltx-generation:retry:v1:${parentId}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function prepareGenerationRetry(
  parentId: string,
  signedTicket: string,
  authorizeRetry: () => void,
): Promise<{ id: string; ticket: string }> {
  const parent = await verifyGenerationTicket(signedTicket);
  if (parent.id !== parentId)
    throw new RequestError('This generation link is invalid.', 403);
  // Unlike checking an existing job, each explicit retry needs studio access.
  authorizeRetry();
  const job = await readGeneration(parent.id);
  if (!job.claimed || !job.error || job.providerId)
    throw new RequestError(
      'Only a failed cut can be retried. Check this cut for its latest status.',
      409,
    );
  const id = retryId(parent.id);
  return {
    id,
    ticket: await createGenerationTicket(parent.plan, parent.direction, id),
  };
}
