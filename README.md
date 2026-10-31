# FlyMS

Find master's programs in Germany in any field, see on a map where admissions are open right now, track applications, and draft an English Statement of Purpose.

Product and technical specs live in [`docs/`](docs/README.md).

## Requirements

- Node.js 22+ and pnpm 10
- Docker (for the local Supabase stack)
- Python 3.10+ (seed scripts, standard library only)

## Getting started

```bash
pnpm install
pnpm db:start            # starts local Supabase, applies migrations and seed
cp .env.example apps/web/.env.local   # then paste the local anon/publishable key from `supabase status`
pnpm exec supabase functions serve --env-file supabase/functions/.env   # Edge Functions (separate terminal)
pnpm dev                 # http://localhost:5173  (component sheet: /dev/components)
```

### Local secrets and admin

- `supabase/functions/.env` (git-ignored) holds Edge Function secrets. For local dev use Cloudflare's Turnstile test secret `1x0000000000000000000000000000000AA`, any `RATE_LIMIT_SECRET`, and `ALLOWED_ORIGINS=http://localhost:5173`.
- Public sign-ups are disabled. Create an admin with
  `SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<from supabase status> node scripts/create-admin.mjs you@example.org '<password>'`, then sign in at `/admin`.

### SOP writer

Locally, `SOP_MOCK=1` in `supabase/functions/.env` returns a clearly-labelled template draft without calling Claude. To use the real model, set `ANTHROPIC_API_KEY` there (and remove `SOP_MOCK`), then run the fabrication/structure eval: `ANON_KEY=<publishable key> node scripts/sop-eval.mjs` (costs real tokens; raise `SOP_DAILY_LIMIT_PER_IP` first).

## Deploying

1. **Supabase** (production project): `supabase link`, `supabase db push`, `supabase functions deploy`, then set secrets with
   `supabase secrets set TURNSTILE_SECRET_KEY=… RATE_LIMIT_SECRET=… ALLOWED_ORIGINS=https://your-domain ANTHROPIC_API_KEY=… LINK_CHECK_SECRET=…`.
   Create the first admin with `scripts/create-admin.mjs`.
2. **Weekly link check**: enable `pg_net` and schedule the job shown at the end of `supabase/migrations/20261031000012_link_status.sql` with your function URL and `LINK_CHECK_SECRET`.
3. **Frontend** (Vercel; `vercel.json` included): set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY`, `SITE_URL` (for sitemap/canonical links), a keyed map tile provider (`VITE_MAP_TILES_*`) and optionally `VITE_PLAUSIBLE_DOMAIN`. The build prerenders one HTML page per program for search engines and link previews.
4. Fill in the operator name and contact in `apps/web/src/pages/LegalPages.tsx` and have the privacy text reviewed.

## Common tasks

| Task                                              | Command                                                                                      |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Unit tests                                        | `pnpm test`                                                                                  |
| Database tests (RLS, status parity)               | `pnpm db:test`                                                                               |
| API contract test (needs local Supabase)          | `FLYMS_API_URL=http://127.0.0.1:54321 FLYMS_ANON_KEY=<key> pnpm --filter @flyms/shared test` |
| Lint / typecheck / build                          | `pnpm lint` · `pnpm typecheck` · `pnpm build`                                                |
| Rebuild seed after editing CSVs                   | `pnpm seed:build && pnpm db:reset`                                                           |
| Regenerate SQL status tests after editing vectors | `python3 -I scripts/gen_status_pgtap.py`                                                     |
| Copy shared schemas to Edge Functions             | `python3 -I scripts/sync_function_shared.py`                                                 |
| E2E tests (needs Supabase + functions running)    | `pnpm test:e2e`                                                                              |
| Regenerate icons and the social image             | `node scripts/gen-brand-assets.mjs`                                                          |

## Layout

```
apps/web/            React SPA (Vite, Tailwind, Radix)
packages/shared/     Status engine, Zod schemas — shared by web and Edge Functions
supabase/            Migrations, seed CSVs → seed.sql, pgTAP tests
scripts/             Seed builders and the reference-data decoder
data/reference/      (git-ignored) local reference dataset used once to build the seed CSVs
```

## Data

`supabase/seed/*.csv` are the source of truth for seed data. The 60 initial CS programs were imported from the reference site's public dataset and have **no `last_verified_at`** — each must be re-checked against its official page before launch.
