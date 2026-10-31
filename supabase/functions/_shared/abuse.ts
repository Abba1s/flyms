import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http.ts';

const TURNSTILE_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Verify a Cloudflare Turnstile token. Throws 403 on failure. */
export async function verifyTurnstile(token: unknown, ip: string | null): Promise<void> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) throw new HttpError(500, 'Bot protection is not configured');
  if (typeof token !== 'string' || token.length === 0 || token.length > 2048) {
    throw new HttpError(403, 'Bot check missing — please reload and try again');
  }
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  const res = await fetch(TURNSTILE_URL, { method: 'POST', body });
  const result = (await res.json()) as { success: boolean };
  if (!result.success) throw new HttpError(403, 'Bot check failed — please reload and try again');
}

export function clientIp(req: Request): string | null {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  );
}

function berlinDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

/**
 * Rate-limit key: HMAC(secret, ip | Berlin date). The salt changes daily, so keys cannot be
 * linked across days, and raw IPs are never stored.
 */
async function rateKey(ip: string): Promise<string> {
  const secret = Deno.env.get('RATE_LIMIT_SECRET');
  if (!secret) throw new HttpError(500, 'Rate limiting is not configured');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${ip}|${berlinDate()}`),
  );
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Count this request against the visitor's daily limit for `bucket`. Throws 429 when exceeded. */
export async function enforceRateLimit(
  admin: SupabaseClient,
  ip: string | null,
  bucket: string,
  max: number,
): Promise<void> {
  const { data, error } = await admin.rpc('check_rate_limit', {
    p_key: await rateKey(ip ?? 'unknown'),
    p_bucket: bucket,
    p_max: max,
  });
  if (error) throw new HttpError(500, 'Rate limit check failed');
  if (data !== true) throw new HttpError(429, 'Daily limit reached — please try again tomorrow');
}
