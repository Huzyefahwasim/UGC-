import { createHash, timingSafeEqual } from 'node:crypto';
import { RequestError } from './server.ts';

export const generationAccessRequired = () =>
  Boolean(
    process.env.STUDIO_ACCESS_CODE?.trim() ||
    process.env.VERCEL ||
    process.env.NODE_ENV === 'production',
  );

export function checkGenerationAccess(request: Request) {
  const code = process.env.STUDIO_ACCESS_CODE?.trim();
  if (!code && generationAccessRequired())
    throw new RequestError(
      'The studio owner needs to configure a generation access code to protect the free GPU allowance.',
      503,
    );
  if (!code) return;
  const supplied = request.headers.get('x-studio-access') || '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (
    !supplied ||
    supplied.length > 300 ||
    !timingSafeEqual(digest(supplied), digest(code))
  )
    throw new RequestError(
      'Enter the studio access code to generate a video.',
      401,
    );
}
