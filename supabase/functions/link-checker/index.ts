/**
 * Check official and application links of published programs and record the results.
 * Callable by an admin (JWT) or by a scheduler with the `x-cron-secret` header.
 */
import { createClient } from '@supabase/supabase-js';
import { corsHeaders, HttpError, json, log } from '../_shared/http.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const TIMEOUT_MS = 12_000;
const CONCURRENCY = 6;
const MAX_URLS = 800;
const USER_AGENT = 'UTEC-LinkChecker/1.0 (checks that program links still work)';

async function authorize(req: Request) {
  const secret = Deno.env.get('LINK_CHECK_SECRET');
  if (secret && req.headers.get('x-cron-secret') === secret) return;
  const authorization = req.headers.get('authorization');
  if (!authorization) throw new HttpError(401, 'Sign in required');
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data } = await db.rpc('is_admin');
  if (data !== true) throw new HttpError(403, 'Admins only');
}

async function probe(url: string): Promise<number | null> {
  const attempt = async (method: 'HEAD' | 'GET') => {
    const res = await fetch(url, {
      method,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    await res.body?.cancel();
    return res.status;
  };
  try {
    const status = await attempt('HEAD');
    // Many university servers reject HEAD; confirm failures with GET.
    return status >= 400 ? await attempt('GET') : status;
  } catch {
    try {
      return await attempt('GET');
    } catch {
      return null; // DNS failure, timeout, TLS error
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);
  try {
    await authorize(req);
    const { data: programs, error } = await admin
      .from('programs')
      .select('id, official_url, application_url')
      .eq('state', 'published')
      .is('deleted_at', null);
    if (error) throw new HttpError(500, 'Could not load programs');

    const jobs: { program_id: string; url: string }[] = [];
    const seen = new Set<string>();
    for (const p of programs) {
      for (const url of [p.official_url, p.application_url]) {
        if (!url || seen.has(`${p.id}|${url}`)) continue;
        seen.add(`${p.id}|${url}`);
        jobs.push({ program_id: p.id, url });
      }
    }
    const batch = jobs.slice(0, MAX_URLS);

    // Probe each distinct URL once, a few at a time.
    const results = new Map<string, number | null>();
    const urls = [...new Set(batch.map((j) => j.url))];
    let next = 0;
    await Promise.all(
      Array.from({ length: CONCURRENCY }, async () => {
        while (next < urls.length) {
          const url = urls[next++]!;
          results.set(url, await probe(url));
        }
      }),
    );

    const rows = batch.map((j) => {
      const status = results.get(j.url) ?? null;
      return { ...j, http_status: status, ok: status !== null && status < 400 };
    });
    const { error: insertError } = await admin.from('link_checks').insert(rows);
    if (insertError) throw new HttpError(500, 'Could not save results');

    const failed = rows.filter((r) => !r.ok).length;
    log('links.checked', { checked: rows.length, failed, skipped: jobs.length - batch.length });
    return json(req, { checked: rows.length, failed });
  } catch (err) {
    if (err instanceof HttpError) return json(req, { error: err.message }, err.status);
    log('links.error', { message: String(err) });
    return json(req, { error: 'Link check failed' }, 500);
  }
});
