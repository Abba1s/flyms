/**
 * Anonymous submissions: change requests, data reports, questions and reviews.
 * Turnstile → per-visitor daily limit → Zod validation → insert with the service role.
 */
import { createClient } from '@supabase/supabase-js';
import { clientIp, enforceRateLimit, verifyTurnstile } from '../_shared/abuse.ts';
import { corsHeaders, HttpError, json, log, readJson } from '../_shared/http.ts';
import { SUBMISSION_LIMITS, submissionSchema, type Submission } from '../_shared/submissions.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  {
    auth: { persistSession: false },
  },
);

async function insert(submission: Submission): Promise<string> {
  const { kind, data } = submission;
  let query;
  switch (kind) {
    case 'change_request': {
      const { type, proposal, note, submitter_name, submitter_email, submitter_phone } = data;
      query = admin.from('change_requests').insert({
        type,
        program_id: data.type === 'update_program' ? data.program_id : null,
        payload: proposal,
        note,
        submitter_name,
        submitter_email,
        submitter_phone,
      });
      break;
    }
    case 'data_report':
      query = admin.from('data_reports').insert(data);
      break;
    case 'question':
      query = admin.from('questions').insert(data);
      break;
    case 'review':
      query = admin.from('reviews').insert(data);
      break;
  }
  const { data: row, error } = await query.select('id').single();
  if (error) {
    // Foreign-key failures mean the referenced program does not exist.
    if (error.code === '23503') throw new HttpError(400, 'That program no longer exists');
    throw new HttpError(500, 'Could not save your submission');
  }
  return row.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  try {
    const body = (await readJson(req)) as { turnstileToken?: unknown };
    const ip = clientIp(req);
    await verifyTurnstile(body.turnstileToken, ip);

    const parsed = submissionSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, 'Please check the highlighted fields', parsed.error.flatten());
    }
    await enforceRateLimit(
      admin,
      ip,
      `submit_${parsed.data.kind}`,
      SUBMISSION_LIMITS[parsed.data.kind],
    );

    const id = await insert(parsed.data);
    log('submission.created', { kind: parsed.data.kind });
    return json(req, { id }, 201);
  } catch (err) {
    if (err instanceof HttpError) {
      log('submission.rejected', { status: err.status, reason: err.message });
      return json(req, { error: err.message, details: err.details }, err.status);
    }
    log('submission.error', { message: String(err) });
    return json(req, { error: 'Something went wrong' }, 500);
  }
});
