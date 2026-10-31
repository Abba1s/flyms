# FlyMS — Project Documents

Working name: **FlyMS** (final name TBD). A free web app that helps international students find, track, and apply to **master's programs in Germany across all fields**, see on a map where admissions are open right now, and draft an English Statement of Purpose.

| # | Document | Answers |
|---|---|---|
| 1 | [Product Requirements (PRD)](01-PRD.md) | What are we building, for whom, and what is in/out of scope? |
| 2 | [Technical Requirements (TRD)](02-TRD.md) | Which stack, architecture, integrations, and non-functional targets? |
| 3 | [App Flow](03-APP-FLOW.md) | What screens exist and how does a user move between them? |
| 4 | [Design Brief](04-DESIGN-BRIEF.md) | How does it look and feel? Tokens, components, map styling. |
| 5 | [Backend Schema](05-BACKEND-SCHEMA.md) | Tables, enums, views, RPCs, Edge Functions, RLS. |
| 6 | [Implementation Plan](06-IMPLEMENTATION-PLAN.md) | Phases, tasks, acceptance criteria, order of work. |

## Locked decisions

| Topic | Decision |
|---|---|
| Degree level | Master's only (MSc, MA, MEng, MBA, LLM, MEd, MFA, …) |
| Fields | All fields, two-level taxonomy (broad field → specialization) based on ISCED-F 2013 |
| Country | Germany only |
| Public login | None. Public user data lives in the browser (localStorage) with JSON export/import |
| Admin login | Supabase Auth (email + password), admin role required |
| SOP language | English only |
| UI language | English only (strings externalised for future locales) |
| Map | Shows admission status per program: Open now / Closing soon / Opening soon / Closed |
| Stack | Vite + React + TypeScript + Tailwind · Supabase (Postgres, RLS, Edge Functions) · Claude API · Leaflet |
| Reference app | https://rarcse.github.io (Germany UniHub) — feature reference only; no code, keys, or backend reused |

## Open items (must close before or during Phase 0)

1. Final product name and domain.
2. Licence check for bulk data sources (DAAD International Programmes, Hochschulkompass). Until confirmed, data is entered manually / via admin CSV import from official university pages.
3. Starter dataset owner: who verifies the first ~10–20 programs per broad field.
