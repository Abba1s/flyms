# 6 · Implementation Plan

**Version:** 1.0 draft · **Date:** 2026-10-31 · **Related:** all docs (FR ids refer to the [PRD](01-PRD.md))

---

## 0. Principles

- Build in **vertical slices**: each milestone ends with something usable and deployed to a preview URL.
- **Data first:** the status engine and dataset quality decide whether the product is useful.
- Every milestone has explicit **acceptance criteria**; it is not done until they pass in CI.
- Nothing from the reference site (code, keys, backend) is reused — only its feature list and publicly available program facts (re-verified from official sources).

## Definition of Done (every task)
- Typed (no `any`), lint + format clean.
- Unit tests for logic; E2E for user-facing flows touched.
- Works at 320 px and in dark mode; keyboard accessible; axe has no serious violations.
- Docs updated if behaviour/schema changed.

---

## Phase 0 — Foundation & data

**Goal:** Project skeleton, database, and verified starter data.

| # | Task | Output |
|---|---|---|
| 0.1 | Monorepo: pnpm workspaces, `apps/web` (Vite + React + TS + Tailwind), `packages/shared`, ESLint/Prettier, Vitest, Playwright | Running dev server |
| 0.2 | Design tokens (`tokens.css`, light/dark), fonts, base UI components (Button, Badge, Chip, Card, Dialog, Sheet, Toast, Select, Input) | Component page `/dev/components` |
| 0.3 | Supabase project (local + staging); migrations 0001–0010 per [Schema](05-BACKEND-SCHEMA.md) | `supabase db reset` works |
| 0.4 | pgTAP tests for RLS (anon read-only; moderation tables hidden; admin RPCs reject non-admins) | Green DB tests |
| 0.5 | **Status engine** in `packages/shared` + shared test vectors + SQL view parity test | 100 % branch coverage |
| 0.6 | Field taxonomy: 12 broad fields + ~120 specializations (ISCED-F based) | `fields.csv`, `specializations.csv` |
| 0.7 | Migrate the 60 CS programs into new schema (re-verify each against official page; add field/specializations/highlights) | Seed CSVs |
| 0.8 | Starter set: 10–20 programs per non-CS field from official pages (owner to confirm per Open Item #3) | ≥ 250 programs total |
| 0.9 | CI: GitHub Actions (lint, typecheck, unit, pgTAP, build, size-limit); Vercel preview per PR | Preview URL per PR |

**Acceptance criteria**
- `pnpm test` and DB tests pass in CI.
- Status engine returns identical results to `v_program_status` for all vectors.
- Every seeded program has `field`, ≥ 1 intake, `official_url`, `source_url`, `last_verified_at`.

---

## Phase 1 — MVP: Discover, Map, Save, Admin

**Goal:** Public can find what's open now in any field, on a list or map, and save programs. Admin can maintain data.

### 1A · Discovery
| # | Task | FR |
|---|---|---|
| 1.1 | App shell: router, layouts (sidebar / bottom tabs), theme toggle, 404 | FR-100 |
| 1.2 | Dataset loading (TanStack Query + IndexedDB persistence + offline banner) | NFR-06 |
| 1.3 | URL filter state (Zod parse/serialise) shared by Explore and Map | FR-05, FR-17 |
| 1.4 | Explore page: search (minisearch in worker), filters, sort, pagination, cards/table, empty states | FR-01–04, FR-06 |
| 1.5 | Program detail page + university detail page | FR-30, FR-31 |
| 1.6 | Home: hero search + field tiles with live "open now" counts | G1 |

### 1B · Admission-status map
| # | Task | FR |
|---|---|---|
| 1.7 | Map route (lazy), tiles light/dark, fit Germany | FR-10 |
| 1.8 | Status pins + open-count badges + clustering by urgency | FR-11, FR-12, FR-15 |
| 1.9 | Status chips (default Open now) + field chips + summary bar + legend | FR-13, FR-16 |
| 1.10 | Popup (desktop) & bottom sheet (mobile) with grouped programs and actions | FR-14, FR-18 |
| 1.11 | "Last verified" + Report wrong date in popup | FR-19 |

### 1C · My List (local)
| # | Task | FR |
|---|---|---|
| 1.12 | Persisted Zustand store (versioned, migrations, storage-blocked fallback) | FR-40, FR-46 |
| 1.13 | My List page (list view), Save toggles everywhere with undo toast | FR-40 |
| 1.14 | Exports: .xlsx, .csv; JSON backup export/import in Settings | FR-41, FR-45 |

### 1D · Community input & admin
| # | Task | FR |
|---|---|---|
| 1.15 | Turnstile integration + `public-submit` Edge Function + rate limits | FR-74 |
| 1.16 | Contribute form (new / update) and Report dialog | FR-70, FR-71 |
| 1.17 | Admin auth + guarded layout + dashboard skeleton | FR-90 |
| 1.18 | Admin programs table + editor (intakes, specializations, highlights, publish, verify, soft delete/restore) | FR-91 |
| 1.19 | Admin universities + taxonomy editors | FR-92 |
| 1.20 | CSV import pipeline (`admin-import`, diff review, apply) | FR-93 |
| 1.21 | Moderation queues: change requests (diff + approve/reject), reports | FR-94 |
| 1.22 | FAQ page (+ glossary) | FR-101 |

**Acceptance criteria (MVP)**
- From Home, a user selects "Engineering" and sees only open Engineering programs on the map in ≤ 2 taps; summary count matches the list view.
- Pin colours follow urgency rules; verified by E2E with a frozen clock at boundary dates.
- Saved programs survive reload; xlsx export opens in Excel/Sheets with correct columns.
- Contribute → admin approves → change is visible publicly; audit log entry exists.
- Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95 on Explore and Map.
- **MVP deployed to production.**

---

## Phase 2 — v1.0: SOP Writer, Tracker, Deadlines

**Goal:** Users can draft a field-specific English SOP and manage their applications.

### 2A · SOP writer
| # | Task | FR |
|---|---|---|
| 2.1 | Field templates (8): question sets (Zod schemas), section structures, example answers | FR-51 |
| 2.2 | Wizard (5 steps), prefill from program/popup, autosave to local draft | FR-50, FR-56 |
| 2.3 | `sop-generate` Edge Function: Turnstile, rate limit + global cap, DB lookup of program facts, prompt with no-fabrication rules, streaming SSE, structured sections | FR-52, FR-53, FR-58, FR-60 |
| 2.4 | SOP evaluation suite: 20 fixtures across templates; checks no invented entities beyond inputs, placeholders present when inputs missing, word count in range | FR-52 |
| 2.5 | Editor (TipTap): sections, placeholder highlighting, word count, versions | FR-54, FR-56 |
| 2.6 | `sop-rewrite` Edge Function + section toolbar actions | FR-54 |
| 2.7 | Quality hints panel (placeholders, clichés, vague paragraphs, repetition) | FR-55 |
| 2.8 | Exports: DOCX, PDF, copy; disclaimer | FR-57, FR-59 |
| 2.9 | "Write SOP" entry points: program detail, map popup, My List | FR-14, FR-32 |

### 2B · Tracker, deadlines, compare, community
| # | Task | FR |
|---|---|---|
| 2.10 | Tracker statuses + Kanban board (drag & keyboard) | FR-42 |
| 2.11 | Auto-generated document checklist + notes | FR-43, FR-44 |
| 2.12 | Deadline calendar (month + agenda) + .ics export | FR-80, FR-81 |
| 2.13 | Compare view (2–4 programs) | FR-82 |
| 2.14 | Ask a question + Reviews (submit, moderation queue, public display) | FR-72, FR-73 |
| 2.15 | Admin audit log viewer + dashboard stats (`mv_admin_stats`) | FR-95, FR-96 |

**Acceptance criteria (v1.0)**
- A user completes the wizard and gets a streamed 800–1,000-word draft in < 60 s; no fact appears that was not in their answers or program data (eval suite passes 20/20).
- Missing optional answers produce visible placeholders; export to DOCX/PDF preserves formatting.
- Rate limit returns a friendly message on the 6th generation of the day; answers are kept.
- No SOP text appears in server logs (verified by log inspection test).
- Tracker state, notes, and drafts survive reload and JSON backup/restore round-trip.

---

## Phase 3 — v1.1: Polish, offline, growth

| # | Task | FR |
|---|---|---|
| 3.1 | PWA: installable, offline app shell + dataset + local data | FR-102 |
| 3.2 | Cookie-less analytics + events (save, export, SOP generate/export) | FR-103 |
| 3.3 | SEO: prerendered meta/OG per program (build-time) | FR-104 |
| 3.4 | Status-as-of-date slider on map | FR-20 |
| 3.5 | Cost estimator | FR-83 |
| 3.6 | Weekly link checker + admin broken-link view | FR-97 |
| 3.7 | Full accessibility audit + fixes; performance pass | NFR-01, NFR-02 |
| 3.8 | Data growth: licensed bulk import (if cleared) and contributor drive | G2 |
| 3.9 | Privacy page, about page, final branding assets | NFR-04 |

**Acceptance criteria (v1.1)**
- App installs on Android/iOS; My List and drafts work with network off.
- ≥ 300 published programs; every field ≥ 10.
- Zero serious/critical axe violations across all public routes.

---

## Milestone summary

| Milestone | Contents | Exit gate |
|---|---|---|
| **M0** Foundation | Phase 0 | Seeded DB + CI green + preview deploy |
| **M1** MVP | Phase 1 | MVP acceptance criteria + production deploy |
| **M2** v1.0 | Phase 2 | SOP eval suite 20/20 + v1.0 acceptance criteria |
| **M3** v1.1 | Phase 3 | PWA + data targets + a11y audit |

## Dependencies & who does what

| Item | Owner | Needed by |
|---|---|---|
| Supabase project + Vercel account | You (create), Claude (configure) | Phase 0 start |
| Anthropic API key | You | Phase 2 start |
| Cloudflare Turnstile keys | You | Task 1.15 |
| Final product name + domain | You | Phase 3 (placeholder until then) |
| Data source licence decision | You | Task 3.8 |
| Verification of starter data | You / curators review; Claude drafts | Task 0.8 |

## Risks to schedule

| Risk | Impact | Response |
|---|---|---|
| Starter data verification takes longer than coding | Delays MVP usefulness | Launch MVP with fewer fields fully verified; mark others "coming soon" |
| SOP eval reveals fabrication | Blocks v1.0 | Tighten prompt + post-generation entity check against inputs before release |
| Map performance with many pins on low-end phones | Poor UX | Clustering + canvas renderer + limit popups to 5 programs |
