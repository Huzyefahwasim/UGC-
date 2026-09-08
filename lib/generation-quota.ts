import { readLimited, RequestError } from './server.ts';

// The public LTX Space reserves 60 seconds on xlarge (2x quota) for clips
// up to seven seconds. This is a reservation, not the actual rendering time.
const REQUIRED_SECONDS = 120;
const QUOTA_URL = 'https://huggingface.co/api/spaces/zero-gpu/quota';

export type GenerationQuota =
  | { known: false }
  | {
      known: true;
      available: boolean;
      remainingSeconds: number;
      requiredSeconds: 120;
      resetAt: string | null;
      reason: 'gpu' | 'runs' | null;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isReset(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
      Number.isFinite(Date.parse(value)))
  );
}

function snapshot(value: unknown): GenerationQuota {
  if (
    !isRecord(value) ||
    !isNumber(value.base) ||
    value.base < 0 ||
    !isNumber(value.current) ||
    !isReset(value.resetsAt)
  )
    return { known: false };

  const runs = value.runs;
  if (
    runs !== undefined &&
    (!isRecord(runs) ||
      !isNumber(runs.used) ||
      runs.used < 0 ||
      !isNumber(runs.limit) ||
      runs.limit < 0 ||
      !isNumber(runs.remaining) ||
      !isReset(runs.resetsAt))
  )
    return { known: false };

  const gpuBlocked = value.current < REQUIRED_SECONDS;
  const runsBlocked = isRecord(runs) && (runs.remaining as number) <= 0;
  const blockedResets = [
    ...(gpuBlocked ? [value.resetsAt] : []),
    ...(runsBlocked ? [runs.resetsAt as string | null] : []),
  ];
  // Both limits must clear. Never promise a reset if one exhausted limit has
  // no known reset; otherwise use the later of the independent windows.
  const resetAt = blockedResets.length
    ? blockedResets.includes(null)
      ? null
      : new Date(
          Math.max(...blockedResets.map((date) => Date.parse(date!))),
        ).toISOString()
    : value.resetsAt;
  return {
    known: true,
    available: !gpuBlocked && !runsBlocked,
    remainingSeconds: Math.max(0, value.current),
    requiredSeconds: REQUIRED_SECONDS,
    resetAt,
    reason: gpuBlocked ? 'gpu' : runsBlocked ? 'runs' : null,
  };
}

export async function getGenerationQuota(): Promise<GenerationQuota> {
  const token = process.env.HUGGINGFACE_TOKEN?.trim();
  if (!token || !/^hf_[A-Za-z0-9]+$/.test(token)) return { known: false };
  try {
    const response = await fetch(QUOTA_URL, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { known: false };
    }
    const bytes = await readLimited(response, 16 * 1024);
    return snapshot(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    // Quota inspection is optional. A failed inspection must not invent an
    // exhausted allowance or expose provider errors, identity, or credentials.
    return { known: false };
  }
}

export async function requireGenerationQuota(): Promise<void> {
  const quota = await getGenerationQuota();
  if (!quota.known || quota.available) return;
  const limit =
    quota.reason === 'runs'
      ? 'The free video generation limit has been reached.'
      : 'There is not enough free video allowance for another cut.';
  const reset = quota.resetAt
    ? ` It resets at ${new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
        timeZoneName: 'short',
      }).format(new Date(quota.resetAt))}.`
    : ' Try again later.';
  throw new RequestError(
    `${limit}${reset} You can finish with stock assets now.`,
    429,
  );
}
