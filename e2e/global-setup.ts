import { execFileSync } from 'node:child_process';

export const ADMIN_EMAIL = 'e2e-admin@flyms.local';
export const ADMIN_PASSWORD = 'e2e-admin-password-123';

/** Ensure a local admin account exists for admin E2E tests. */
export default function globalSetup() {
  const status = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8' }),
  ) as { API_URL: string; SERVICE_ROLE_KEY: string };
  execFileSync('node', ['scripts/create-admin.mjs', ADMIN_EMAIL, ADMIN_PASSWORD], {
    env: {
      ...process.env,
      SUPABASE_URL: status.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    },
    stdio: 'inherit',
  });
  // Local only: reset per-visitor limits so repeated runs are not throttled.
  for (const table of ['rate_limits', 'usage_daily']) {
    execFileSync('curl', [
      '-s',
      '-X',
      'DELETE',
      `${status.API_URL}/rest/v1/${table}?count=gte.0`,
      '-H',
      `apikey: ${status.SERVICE_ROLE_KEY}`,
      '-H',
      `Authorization: Bearer ${status.SERVICE_ROLE_KEY}`,
    ]);
  }
}
