import type { Submission } from '@flyms/shared';
import type { ZodError } from 'zod';
import { track } from '@/lib/analytics';

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export class SubmitError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Send a public submission through the `public-submit` Edge Function. */
export async function submitPublic(
  submission: Submission,
  turnstileToken: string,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${FUNCTIONS_URL}/public-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
      body: JSON.stringify({ ...submission, turnstileToken }),
    });
  } catch {
    throw new SubmitError('You seem to be offline. Your answers are kept — try again.', 0);
  }
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !body.id) {
    throw new SubmitError(body.error ?? 'Something went wrong. Please try again.', res.status);
  }
  track('Submission', { kind: submission.kind });
  return body.id;
}

/** Map Zod issues to `{ 'a.b': message }` for inline field errors. */
export function fieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    out[key] ??= issue.message;
  }
  return out;
}
