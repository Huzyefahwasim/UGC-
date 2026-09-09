import {
  claimGeneration,
  readGeneration,
  recordGeneration,
} from './generation-jobs.ts';
import { submitVideo } from './generation-provider.ts';
import { WAN_REQUIRED_SECONDS } from './wan-config.ts';
import { requireGenerationQuota } from './generation-quota.ts';
import { RequestError } from './server.ts';
import type { VideoPlan } from './types.ts';

type Result = { providerId?: string; error?: string };
type Ticket = { id: string; plan: VideoPlan; direction: string };
type Dependencies = {
  read: (id: string) => Promise<{ claimed: boolean } & Result>;
  claim: (id: string) => Promise<boolean>;
  record: (id: string, result: Result) => Promise<void>;
  submit: (plan: VideoPlan, direction: string) => Promise<{ id: string }>;
};

const defaults: Dependencies = {
  read: readGeneration,
  claim: claimGeneration,
  record: recordGeneration,
  submit: async (plan, direction) => {
    await requireGenerationQuota(
      plan.engine === 'wan' ? WAN_REQUIRED_SECONDS : 120,
    );
    return submitVideo(plan, direction);
  },
};

const UNCONFIRMED =
  'We could not finish this video request. No automatic retry was submitted. Try later or create a cut with free assets.';

async function persist(
  id: string,
  result: Result,
  record: Dependencies['record'],
) {
  // The record store is immutable and accepts identical replays. Retrying this
  // write is safe even if the previous attempt succeeded but its reply was lost.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await record(id, result);
      return;
    } catch {
      if (attempt === 2)
        throw new Error('Generation result persistence failed');
    }
  }
}

function submissionFailure(error: unknown): {
  message: string;
  status: number;
} {
  // These provider RequestErrors come from explicit HTTP rejections or missing
  // configuration. Network/malformed-response/timeout errors (502/504) cannot
  // establish that the provider did not accept the quota-consuming request.
  if (error instanceof RequestError && [400, 429, 503].includes(error.status))
    return { message: error.message, status: error.status };
  return { message: UNCONFIRMED, status: 502 };
}

export async function startGeneration(
  ticket: Ticket,
  authorizeNewSubmission: () => void,
  dependencies: Dependencies = defaults,
): Promise<{ id: string }> {
  const { id, plan, direction } = ticket;
  // Authorization is needed only for a new quota-consuming operation. A ticket owner
  // can resume the already claimed operation without spending credits again.
  if ((await dependencies.read(id)).claimed) return { id };
  authorizeNewSubmission();
  if (!(await dependencies.claim(id))) return { id };

  let submitted: { id: string };
  try {
    // There is exactly one provider invocation, outside every persistence retry.
    submitted = await dependencies.submit(plan, direction);
  } catch (error) {
    const failure = submissionFailure(error);
    try {
      await persist(id, { error: failure.message }, dependencies.record);
    } catch {
      throw new RequestError(
        `${failure.message} The studio could not save the job status. Keep this conversation and resume to check it.`,
        failure.status,
      );
    }
    return { id };
  }

  // A completed footage reference must never be replaced by an error record.
  // Persistence retries reuse the result, without spending more GPU quota.
  try {
    await persist(id, { providerId: submitted.id }, dependencies.record);
  } catch {
    throw new RequestError(
      'The video service finished the footage, but the studio could not save it. Storage needs attention before another generation. No automatic retry was submitted.',
      503,
    );
  }
  return { id };
}
