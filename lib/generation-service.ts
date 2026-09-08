import {
  claimGeneration,
  readGeneration,
  recordGeneration,
} from './generation-jobs.ts';
import { submitVideo } from './higgsfield.ts';
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
  submit: submitVideo,
};

const UNCONFIRMED =
  'We could not confirm the generation submission. Check Higgsfield Cloud before starting another cut; a generation may already be running.';

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
  // establish that the provider did not accept the billable request.
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
  // Authorization is needed only for a new billable operation. A ticket owner
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
        `${failure.message} The studio could not save the job status. Keep this conversation and check Higgsfield Cloud before creating another video.`,
        failure.status,
      );
    }
    return { id };
  }

  // A confirmed provider ID must never be replaced by an error record. If the
  // store remains unavailable, give the owner the ID needed for Cloud recovery.
  try {
    await persist(id, { providerId: submitted.id }, dependencies.record);
  } catch {
    throw new RequestError(
      `Higgsfield accepted your video, but the studio could not save its tracking record. Your Higgsfield job ID is ${submitted.id}. Keep this ID and find the video in Higgsfield Cloud. Do not start another cut for this request; the original may still be running.`,
      503,
    );
  }
  return { id };
}
