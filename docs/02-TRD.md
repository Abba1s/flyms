# 2 · Technical Requirements Document (TRD)

**Version:** 1.0 draft · **Date:** 2026-10-31 · **Related:** [PRD](01-PRD.md), [Backend Schema](05-BACKEND-SCHEMA.md)

---

## 1. Architecture overview

```
┌──────────────────────────── Browser (SPA / PWA) ─────────────────────────────┐
│ React + TS + Tailwind                                                         │
│  ├─ Pages: Explore · Map · Program · University · My List · Tracker · SOP ·   │
│  │         Calendar · Compare · Contribute · Ask · FAQ · Admin                │
│  ├─ TanStack Query  ── reads ──▶ Supabase REST (public views, anon key)        │
│  ├─ Zustand + localStorage  (My List, tracker, notes, SOP drafts, settings)   │
│  └─ Service Worker (Workbox): app shell + last dataset cache                  │
└──────────────┬──────────────────────────────────────────────┬────────────────┘
               │ anon key (RLS read-only on public views)      │ HTTPS + Turnstile token
               ▼                                               ▼
┌──────────── Supabase ─────────────────────┐     ┌──── Supabase Edge Functions (Deno) ────┐
│ Postgres 15 + RLS                          │◀────│ public-submit   (contrib/report/Q/review)│
│  tables · views · RPCs · pg_cron           │     │ sop-generate    ──▶ Claude API          │
│ Auth (admins only)                         │     │ sop-rewrite     ──▶ Claude API          │
│ Storage (import CSVs)                      │     │ admin-import    (CSV parse + diff)      │
└────────────────────────────────────────────┘     │ link-checker    (pg_cron weekly)        │
                                                   └─────────────────────────────────────────┘
```

Static frontend is deployed to a CDN (Vercel recommended; GitHub Pages also works). All writes from anonymous users go through Edge Functions, never directly to tables.

## 2. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Build | **Vite 6**, TypeScript 5 (strict) | Fast, simple SPA build |
| UI | **React 18**, React Router 6 (data routers) | Mature, large ecosystem |
| Styling | **Tailwind CSS 3** + CSS variables for tokens | Matches design-token approach |
| Components | Radix UI primitives (Dialog, Popover, Tabs, Select, Toast) | Accessible headless primitives |
| Server state | **TanStack Query 5** | Caching, retries, offline fallback |
| Client state | **Zustand** with `persist` middleware (localStorage, versioned) | Small, simple persistence |
| Forms / validation | React Hook Form + **Zod** (schemas shared with Edge Functions) | One validation source |
| Map | **Leaflet 1.9** + react-leaflet 4 + leaflet.markercluster; OpenStreetMap / CARTO tiles | Free, no API key |
| SOP editor | Section-by-section plain-text editor (auto-growing textareas) | SOPs are plain prose; no formatting needed, lighter than a rich-text engine |
| Dates | date-fns + date-fns-tz (Europe/Berlin) | Correct status computation |
| Exports | `exceljs` (xlsx), `papaparse` (CSV), `docx` (DOCX), `jspdf` (PDF), `ics` (calendar) | Client-side, no server cost |
| PWA | vite-plugin-pwa (Workbox) | Offline + installable |
| Backend | **Supabase** (Postgres 15, RLS, Auth, Storage, Edge Functions, pg_cron) | Managed, free tier, SQL-first |
| AI | **Claude API** (Anthropic TypeScript SDK) via Edge Function; model from env `CLAUDE_MODEL` (default `claude-opus-5-5`, effort `medium` via `CLAUDE_EFFORT`), server-side refusal fallback `fallbacks: "default"` | Strong long-form writing |
| Bot protection | Cloudflare **Turnstile** | Free, invisible, privacy-friendly |
| Analytics | Plausible or Umami (cookie-less) | GDPR-friendly |
| Testing | Vitest + Testing Library, Playwright (E2E), pgTAP (RLS/DB) | Full coverage of layers |
| Lint/format | ESLint (typescript-eslint), Prettier | Consistency |
| CI/CD | GitHub Actions → Vercel preview/prod; Supabase CLI migrations | Repeatable deploys |

## 3. Repository structure

```
flyms/
├─ docs/                      # these documents
├─ apps/web/                  # React SPA
│  ├─ src/
│  │  ├─ app/                 # router, providers, layout
│  │  ├─ pages/               # route components
│  │  ├─ features/
│  │  │  ├─ programs/         # list, filters, cards, detail
│  │  │  ├─ map/              # map, pins, popups, clustering
│  │  │  ├─ status/           # admission status engine (pure TS)
│  │  │  ├─ mylist/           # saved, tracker, notes, export
│  │  │  ├─ sop/              # wizard, editor, templates, export
│  │  │  ├─ calendar/  compare/  contribute/  admin/
│  │  ├─ components/ui/       # design-system components
│  │  ├─ lib/                 # supabase client, query keys, utils
│  │  ├─ stores/              # zustand stores (persisted)
│  │  └─ styles/              # tokens.css, tailwind.css
│  └─ tests/
├─ packages/shared/           # zod schemas, types, status engine, field taxonomy
├─ supabase/
│  ├─ migrations/             # SQL migrations (schema, RLS, views, RPCs)
│  ├─ functions/              # Edge Functions (Deno)
│  ├─ seed/                   # fields.csv, universities.csv, programs.csv
│  └─ tests/                  # pgTAP
└─ .github/workflows/
```

Package manager: **pnpm** workspaces.

## 4. Key technical designs

### 4.1 Admission status engine (`packages/shared/status`)
- Pure function `getIntakeStatus(intake, now): Status` and `getProgramStatus(program, now)`.
- `now` converted to Europe/Berlin calendar date; deadline is inclusive through 23:59:59 Berlin time.
- Thresholds are constants: `CLOSING_SOON_DAYS = 14`, `OPENING_SOON_DAYS = 60`.
- Urgency order for aggregation: `closing_soon > open > opening_soon > closed > unknown`.
- Computed **client-side** (so the UI updates at midnight without refetching) and mirrored in SQL view `v_program_status` for admin dashboards and counts. Both implementations share a test-vector JSON file to guarantee identical results.

### 4.2 Data loading
- Public dataset is small (target < 5,000 programs). Load `v_public_programs` (compact columns) once per session, cache with TanStack Query (staleTime 1 h), persist to IndexedDB for offline/outage fallback.
- Filtering, search and sorting run client-side over the in-memory dataset (search via `minisearch` index built in a Web Worker).
- If the dataset exceeds ~5,000 rows, switch to server-side filtering via RPC `search_programs` (designed now, enabled later).
- Program detail fetches the full row + highlights on demand.

### 4.3 URL state
- Single source of truth for filters: URL query params, parsed/serialised with Zod (`?field=engineering&spec=mechatronics&status=open&lang=en&sort=deadline`).
- `/explore` and `/map` read the same params, so switching views keeps filters.

### 4.4 Local persistence
- Zustand store `flyms-local-v1` with `version` + `migrate` for schema upgrades.
- Contents: `savedProgramIds`, `tracker{programId → status, checklist, notes}`, `sopDrafts{id → {programId, field, specialization, answers, versions[]}}`, `compareIds`, `theme`, `dismissedBanners`.
- JSON export/import with Zod validation; import merges or replaces (user choice).
- localStorage access wrapped in try/catch; app works (non-persistent) if storage is blocked.

### 4.5 Map
- Lazy-loaded route chunk. Pins built from universities × filtered programs.
- Custom `divIcon` pins: status colour + status icon + open-count badge (colour never the only signal).
- `leaflet.markercluster` with custom `iconCreateFunction` that colours clusters by most urgent child status.
- Popup content rendered as React portal for consistent styling and actions.
- Mobile (< 768 px): popups replaced by a bottom sheet (Radix Dialog) with the program list.
- Tiles: CARTO Positron (light) / Dark Matter (dark), OSM attribution.

### 4.6 SOP generation
- **Client:** wizard collects answers (validated by Zod schema per field template). Sends `{template, field, specialization, program?, answers, length, turnstileToken}` to `sop-generate`.
- **Edge Function `sop-generate`:**
  1. Verify Turnstile token.
  2. Rate-limit: `sha256(ip + daily_salt)` → `rate_limits` table (5 generations/day/IP; global daily cap from env).
  3. Validate payload with shared Zod schema; enforce length caps (each answer ≤ 1,500 chars, total ≤ 8,000).
  4. Load program facts (name, university, specializations, highlights) from DB by id — never trust client-sent program text.
  5. Build prompt: system prompt with field template structure + **no-fabrication rules** (use only provided facts; insert `[placeholder]` where missing; no invented names, grades, publications, awards); user facts wrapped as data.
  6. Call Claude Messages API with streaming; stream back to client as Server-Sent Events.
  7. Return structured output: sections with ids (`hook`, `academic`, `experience`, `why_specialization`, `why_program`, `why_germany`, `goals`, `closing`).
  8. Log only metadata (template, length, tokens, latency, status) — **no answer text**.
- **Edge Function `sop-rewrite`:** same protections; input = one section + instruction (`regenerate | specific | shorter | formal`) + the user's facts; 20/day/IP.
- **Client quality hints** (no AI): regex/heuristics for placeholders, clichés list, repeated n-grams, paragraphs without numbers/named projects.
- Exports: DOCX (`docx`), PDF (`@react-pdf/renderer`), plain text copy.

### 4.7 Public submissions
- Edge Function `public-submit` handles `change_request`, `data_report`, `question`, `review`.
- Turnstile + rate limit (10/day/IP per type) + Zod validation + HTML stripped.
- Inserts with service role into moderation tables (status `pending`); public cannot read these tables.

### 4.8 Admin
- Supabase Auth email/password; `is_admin()` SQL function checks `admin_users`.
- Admin UI is a lazy-loaded route group under `/admin`, guarded client-side **and** by RLS.
- All admin writes go through RPCs that also write `admin_audit_log` (before/after JSON).
- CSV import: upload to Storage bucket `imports` (admin-only) → `admin-import` function parses with papaparse, validates rows, resolves university/field by slug, computes diff vs existing program (`new | update | unchanged | error`) → `import_rows`. Admin approves rows → RPC `apply_import_rows`.

### 4.9 Scheduled jobs (pg_cron)
| Job | Schedule | Action |
|---|---|---|
| purge_rate_limits | hourly | delete rows older than 48 h |
| rotate_daily_salt | daily 00:00 Berlin | new salt for IP hashing |
| link_checker | weekly | Edge Function HEAD-checks official/application links, flags failures |
| stale_report | daily | refresh `mv_admin_stats` materialised view |

## 5. Environment & secrets

| Name | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Frontend | Public by design; protected by RLS |
| `VITE_TURNSTILE_SITE_KEY` | Frontend | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions only | Never shipped to browser |
| `ANTHROPIC_API_KEY` | Edge Functions only | |
| `CLAUDE_MODEL`, `CLAUDE_EFFORT` | Edge Functions | defaults `claude-opus-5-5`, `medium` |
| `SOP_MOCK` | Edge Functions (local only) | `1` without an API key returns a labelled template draft |
| `TURNSTILE_SECRET_KEY` | Edge Functions only | |
| `SOP_DAILY_LIMIT_PER_IP`, `SOP_GLOBAL_DAILY_CAP`, `REWRITE_DAILY_LIMIT_PER_IP` | Edge Functions | defaults 5 / 500 / 20 |

Environments: `local` (Supabase CLI + Docker), `preview` (per-PR Vercel + staging Supabase), `production`.

## 6. Non-functional implementation

| Concern | Implementation |
|---|---|
| Performance | Route-level code splitting (map, SOP editor, admin, exports lazy); dataset in IndexedDB; images none/SVG; fonts self-hosted subset. Budget enforced in CI (`size-limit`). |
| Accessibility | Radix primitives; axe checks in Playwright; status = colour + icon + text; focus management in dialogs/bottom sheet; map has an equivalent list view. |
| Security | RLS default-deny; anon role can only `select` public views; all writes via Edge Functions/RPCs; CSP header (self + Supabase + tiles + Turnstile + Plausible); input sanitised; admin RPCs `security definer` with `is_admin()` check. |
| Privacy | No cookies except Turnstile's; IP hashed with rotating salt; no SOP content stored or logged; privacy page. |
| Observability | Edge Function structured logs (no PII); Sentry (frontend errors, PII scrubbing); admin dashboard counts. |
| Resilience | If Supabase unreachable → show cached dataset with "offline data from <date>" banner; SOP shows friendly error and keeps answers. |

## 7. Testing strategy

| Layer | Tooling | Must cover |
|---|---|---|
| Status engine | Vitest + shared test vectors | Boundaries (start day, end day 23:59, DST change, leap day, missing dates, multiple intakes); SQL view gives same results |
| Components | Vitest + Testing Library | Filters, cards, popup, wizard steps, local store migrations |
| DB / RLS | pgTAP | Anon cannot read moderation tables or write anything; admin RPCs reject non-admins |
| Edge Functions | Deno test | Turnstile failure, rate limits, validation, prompt contains no-fabrication rules |
| SOP quality | Scripted eval set (20 fixtures across templates) | No invented facts beyond inputs; placeholders when missing; word count in range |
| E2E | Playwright (desktop + Pixel 7 + iPhone 14) | Find open program in field → save → export; map popup flow; SOP wizard → export DOCX; contribute; admin approve change request |
| Accessibility | axe-core in Playwright | No serious/critical violations |

## 8. Compatibility & constraints
- Last 2 versions of evergreen browsers; iOS Safari 16+.
- Works at 320 px width without horizontal scroll.
- All dates stored as `date` (no time) in DB; interpreted in Europe/Berlin.
