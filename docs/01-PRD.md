# 1 · Product Requirements Document (PRD)

**Product:** FlyMS (working name) · **Version:** 1.0 draft · **Date:** 2026-10-31 · **Status:** For review

---

## 1. Summary

FlyMS is a free, no-login web app for international students applying to **master's programs in Germany in any field**. It lets them:

1. **Discover** programs by field, specialization, language, requirements and deadlines.
2. **See on a map where admissions are open right now**, closing soon, or opening soon.
3. **Save and track** programs through their application journey.
4. **Draft an English Statement of Purpose (SOP)** tailored to their chosen field, specialization and target program.

It recreates and extends the feature set of *Germany UniHub* (rarcse.github.io), which covers only ~60 MSc CS programs.

## 2. Problem

- Program information is scattered across university sites, DAAD, Hochschulkompass and uni-assist; deadlines differ per program and intake.
- Students cannot quickly answer *"What can I apply to **today** in my field?"*
- Requirements that matter to internationals (English vs German teaching, IELTS, MOI acceptance, VPD, NC, GRE/GMAT, portfolio) are hard to compare.
- Writing a field-specific SOP is hard; generic templates produce weak letters.

## 3. Goals & non-goals

### Goals
| ID | Goal |
|---|---|
| G1 | Answer "what is open now in my field?" in ≤ 2 interactions from the home page. |
| G2 | Cover all broad fields with at least 10 verified programs each at launch. |
| G3 | Let a student produce a usable, personalised SOP draft in ≤ 10 minutes. |
| G4 | Zero friction: no account required for any public feature. |
| G5 | Data stays trustworthy: every program shows when it was last verified; users can report wrong data. |

### Non-goals (v1)
- Bachelor's, PhD, Studienkolleg, or non-German programs.
- Submitting applications on the user's behalf or integrating with uni-assist.
- User accounts, cross-device sync, social features.
- SOPs in languages other than English; UI in languages other than English.
- Admission probability predictions.

## 4. Users

| Persona | Description | Key needs |
|---|---|---|
| **Applicant (primary)** | International bachelor's graduate, 21–30, mobile-first, often from South Asia / MENA / Africa. | Find eligible English-taught programs, catch deadlines, write SOP. |
| **Contributor** | Applicant or current student who knows a program. | Suggest a new program or correct data quickly, no account. |
| **Admin / Curator** | Project owner(s). | Maintain data, import programs, moderate submissions, see what is popular. |

## 5. Scope — features & functional requirements

Priority: **P0** = launch blocker · **P1** = launch target · **P2** = post-launch.

### 5.1 Program discovery (List)
| ID | Requirement | Pri |
|---|---|---|
| FR-01 | Show all published programs as a paginated, sortable list (cards on mobile, table on desktop). | P0 |
| FR-02 | Full-text search over program name, university, city, specialization. | P0 |
| FR-03 | Filters: broad field, specialization, admission status, intake (Winter/Summer), teaching language, degree type, city/state, university, tuition (free / ≤ €X), IELTS ≤ X, MOI accepted, VPD required, NC restricted, GRE/GMAT required, portfolio required, German level. | P0 |
| FR-04 | Sort by deadline (default: soonest open deadline), QS ranking, tuition, name. | P0 |
| FR-05 | Filter + sort state is stored in the URL (shareable, back-button safe). | P0 |
| FR-06 | Admission status badge and countdown on every program. | P0 |

### 5.2 Admission-status map
| ID | Requirement | Pri |
|---|---|---|
| FR-10 | Map of Germany with one pin per university that has ≥ 1 program matching current filters. | P0 |
| FR-11 | Pin colour = most urgent status among the university's matching programs: Closing soon > Open now > Opening soon > Closed. | P0 |
| FR-12 | Pin badge shows the number of matching programs currently open. | P0 |
| FR-13 | Status chips (Open now · Closing soon · Opening soon · All) — **default: Open now**. Field chips (multi-select). | P0 |
| FR-14 | Popup lists matching programs grouped by status, each with intake, portal, deadline + countdown, IELTS / MOI / VPD / language icons, and actions: ★ Save, Details, Apply ↗, Write SOP. | P0 |
| FR-15 | Pin clustering when zoomed out; cluster colour = most urgent status inside. | P0 |
| FR-16 | Summary line: "N programs open now at M universities" for current filters. | P0 |
| FR-17 | Map and list share one filter state. | P0 |
| FR-18 | Mobile: bottom sheet list "Open now — closing first" under the map. | P0 |
| FR-19 | Popup shows "Dates last verified: <date>" and a "Report wrong date" action. | P1 |
| FR-20 | Date slider: "show status as of <date>" (next 6 months). | P2 |

**Status rules** (computed in Europe/Berlin time, dates inclusive, deadline ends 23:59 local):

| Status | Rule |
|---|---|
| Open now | `start ≤ today ≤ end` (if `start` is unknown and `end ≥ today` → Open now, labelled "start date not stated") |
| Closing soon | Open now **and** `end − today ≤ 14 days` |
| Opening soon | `today < start` **and** `start − today ≤ 60 days` |
| Closed | everything else (past, or opens > 60 days away — shown as "Opens <date>") |
| Unknown | no end date → grey dashed, never counted as open |

A program may have multiple intakes; the program's status is the most urgent intake status.

### 5.3 Program & university details
| ID | Requirement | Pri |
|---|---|---|
| FR-30 | Program detail page: overview, field & specializations, highlights (modules/labs), intakes with dates, requirements, costs, links (official page, application portal), last verified date. | P0 |
| FR-31 | University page: city, mini-map, list of its programs with statuses. | P1 |
| FR-32 | Actions on detail: Save, Apply ↗, Write SOP, Add to compare, Report outdated info, Add deadline to calendar (.ics). | P0 (Save/Apply/SOP/Report) · P1 (compare, .ics) |

### 5.4 My List & application tracker (local, no login)
| ID | Requirement | Pri |
|---|---|---|
| FR-40 | Save/unsave programs; persisted in localStorage. | P0 |
| FR-41 | Export My List to Excel (.xlsx) and CSV. | P0 |
| FR-42 | Per-program tracker status: Researching → Preparing docs → Applied → Interview → Admitted / Rejected / Withdrawn. Kanban + list views. | P1 |
| FR-43 | Per-program document checklist (CV, transcripts, degree cert, LORs, SOP, language test, APS, VPD, portfolio) auto-suggested from program requirements. | P1 |
| FR-44 | Personal notes per program. | P1 |
| FR-45 | Backup: export / import all local data as JSON. | P0 |
| FR-46 | Banner: "Your data is stored only on this device." | P0 |

### 5.5 Statement of Purpose generator (English, no login)
| ID | Requirement | Pri |
|---|---|---|
| FR-50 | Guided wizard: (1) broad field → (2) specialization (only those that exist in data) → (3) target program (from My List, any program, or "General") → (4) profile questions → (5) review → generate. | P0 |
| FR-51 | Question set and letter structure vary by **field template** (Engineering/Science, Computer Science, Business/MBA, Arts & Design, Law, Social Sciences & Humanities, Medicine & Health, Education). | P0 |
| FR-52 | Generated draft uses **only** facts the user provided plus program data (name, highlights). Missing facts appear as visible placeholders like `[add a project example]`. No invented achievements, grades, or names. | P0 |
| FR-53 | Target length 800–1,000 words; live word count; length presets (short ~600 / standard ~900 / long ~1,100). | P0 |
| FR-54 | Rich-text editor with per-section actions: Regenerate, More specific, Shorten, More formal. | P1 |
| FR-55 | Quality hints: flags paragraphs without concrete evidence, clichés ("since childhood…"), repeated phrases, unfilled placeholders. | P1 |
| FR-56 | Drafts and versions stored in localStorage per program; warning to export. | P0 |
| FR-57 | Export DOCX and PDF; copy to clipboard. | P0 |
| FR-58 | Abuse protection: invisible bot check (Cloudflare Turnstile) + rate limit (default 5 generations and 20 section rewrites per IP per day) + input length caps. | P0 |
| FR-59 | Disclaimer: "This is a draft to personalise — not a finished letter. Check each university's requirements." | P0 |
| FR-60 | No SOP inputs or outputs stored on the server. | P0 |

### 5.6 Community input
| ID | Requirement | Pri |
|---|---|---|
| FR-70 | Contribute: suggest a new program or an update to an existing one (name + email required, phone optional). Goes to admin queue. | P0 |
| FR-71 | Report wrong info: one-click from program page/popup with a short reason. | P0 |
| FR-72 | Ask a question: name, email, message → admin inbox. | P1 |
| FR-73 | Program reviews: 1–5 stars + comment, by current students/alumni; shown only after admin approval. | P1 |
| FR-74 | All public submissions protected by Turnstile + per-IP rate limits. | P0 |

### 5.7 Deadlines & comparison
| ID | Requirement | Pri |
|---|---|---|
| FR-80 | Deadline calendar (month + agenda view) of saved programs, or all filtered programs. | P1 |
| FR-81 | .ics export of deadlines (single program and whole My List). | P1 |
| FR-82 | Compare 2–4 programs side by side (requirements, costs, deadlines, status). | P1 |
| FR-83 | Cost estimator: semester contribution + tuition + city living cost + blocked account. | P2 |

### 5.8 Admin
| ID | Requirement | Pri |
|---|---|---|
| FR-90 | Admin login (Supabase Auth); only users in `admin_users` can access. | P0 |
| FR-91 | Programs CRUD with soft-delete/restore, draft/published state, "mark verified today". | P0 |
| FR-92 | Universities, fields, specializations CRUD. | P0 |
| FR-93 | CSV import → validation → diff preview → approve/reject per row. | P0 |
| FR-94 | Queues: change requests, data reports, questions, reviews — approve / reject / mark read / delete. Approving a change request applies it. | P0 |
| FR-95 | Audit log of every admin write (who, what, before/after). | P1 |
| FR-96 | Dashboard: total programs per field, open-now count, stale data (> 180 days unverified), broken links, top viewed/saved programs. | P1 |
| FR-97 | Weekly automated link checker flags broken official/application links. | P2 |

### 5.9 General
| ID | Requirement | Pri |
|---|---|---|
| FR-100 | Light/dark theme (system default + toggle). | P0 |
| FR-101 | FAQ page (how to use, VPD, APS, MOI, uni-assist, blocked account). | P0 |
| FR-102 | Installable PWA; My List, saved programs, and SOP drafts work offline. | P1 |
| FR-103 | Anonymous, cookie-less analytics (page views, saves, SOP generations). | P1 |
| FR-104 | SEO: static meta + Open Graph per program page. | P1 |

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-01 | Performance: LCP ≤ 2.5 s on mid-range Android over 4G; JS ≤ 250 KB gzipped on first load (map & editor lazy-loaded). |
| NFR-02 | Accessibility: WCAG 2.2 AA; full keyboard use; status never conveyed by colour alone (icon + text). |
| NFR-03 | Responsive from 320 px; mobile-first. |
| NFR-04 | Privacy: no public accounts; no SOP data stored server-side; IPs only stored as salted hashes for rate limiting, purged after 48 h. GDPR-compliant privacy page. |
| NFR-05 | Security: RLS on every table; service-role key never in the browser; Claude API key only in Edge Function secrets. |
| NFR-06 | Availability: static frontend on CDN; graceful degradation if Supabase is down (cached last dataset). |
| NFR-07 | Data freshness: every program has `last_verified_at`; stale (> 180 days) shown with a warning badge. |
| NFR-08 | Browser support: last 2 versions of Chrome, Safari (iOS 16+), Firefox, Edge. |

## 7. Success metrics (first 3 months after launch)

| Metric | Target |
|---|---|
| Programs published | ≥ 300, every broad field ≥ 10 |
| Weekly active visitors | 1,000+ |
| % sessions using map status filter | ≥ 30 % |
| Programs saved per returning visitor | ≥ 3 |
| SOP drafts generated → exported | ≥ 40 % export rate |
| Data reports resolved within 7 days | ≥ 90 % |

## 8. Assumptions & dependencies

- Supabase free/pro tier is sufficient for v1 traffic.
- Claude API budget available for SOP generation (cost bounded by rate limits).
- Program data is entered from official university pages; bulk import from DAAD/Hochschulkompass only after licence confirmation.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Stale or wrong deadlines mislead users | Last-verified dates, stale badges, report button, "always check official page" note, admin stale dashboard. |
| SOP feature abused / cost spikes | Turnstile, per-IP daily caps, global daily budget cap with graceful "try tomorrow". |
| Generated SOPs fabricate facts | Strict prompt + placeholder policy + automated test suite on fabrication. |
| Data licensing | Manual curation first; legal check before any bulk import. |
| Spam in contributions/reviews | Turnstile, rate limits, admin moderation before publish. |

## 10. Release scope summary

- **MVP (Phases 0–1):** FR-01–06, FR-10–18, FR-30, FR-32 (P0 parts), FR-40–41, FR-45–46, FR-70–71, FR-74, FR-90–94, FR-100–101.
- **v1.0 (Phase 2):** FR-50–60 (SOP), FR-19, FR-31, FR-42–44, FR-72–73, FR-80–82, FR-95–96.
- **v1.1 (Phase 3+):** FR-20, FR-83, FR-97, FR-102–104.
