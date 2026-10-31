# 4 · Design Brief

**Version:** 1.0 draft · **Date:** 2026-10-31 · **Related:** [App Flow](03-APP-FLOW.md)

---

## 1. Design goals

1. **Urgency at a glance** — admission status is the most important signal on every surface.
2. **Calm and trustworthy** — an advisor, not a marketing site. Data sources and "last verified" are always visible.
3. **Mobile-first** — most users are on Android phones with patchy connections.
4. **Accessible** — WCAG 2.2 AA; colour is never the only signal.

**Personality:** clear · encouraging · precise · international.
**Avoid:** stock photos of students, heavy gradients, flag clichés, tiny text in dense tables on mobile.

## 2. Brand

- **Name:** FlyMS (working) — "fly" to your Master's. Final name TBD.
- **Logo direction:** simple paper-plane mark forming an upward check/arrow; monochrome-safe; works at 16 px favicon.
- **Voice:** second person, short sentences, plain English (B1 level), no jargon without a tooltip (VPD, APS, MOI, NC, uni-assist).
  - Good: "12 programs are open now. 3 close this week."
  - Avoid: "Leverage our cutting-edge platform to optimise your admission journey."

## 3. Design tokens

### 3.1 Colour (light / dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F7F8FB` | `#0E1117` | Page background |
| `--surface` | `#FFFFFF` | `#161B22` | Cards, panels |
| `--surface-2` | `#EEF1F6` | `#1F2630` | Inputs, hovers |
| `--border` | `#DCE1EA` | `#2D3643` | Dividers |
| `--text` | `#111827` | `#E6EAF0` | Body |
| `--muted` | `#5B6474` | `#9AA4B2` | Secondary text |
| `--primary` | `#4338CA` (indigo) | `#8B85FF` | Brand, primary buttons, links |
| `--primary-contrast` | `#FFFFFF` | `#0E1117` | Text on primary |
| `--danger` | `#C2410C` | `#F97366` | Destructive actions |

**Status colours (reserved — never used for anything else):**

| Status | Token | Light | Dark | Icon | Label |
|---|---|---|---|---|---|
| Open now | `--st-open` | `#166534` | `#4ADE80` | ● filled circle | "Open · closes 15 Jan" |
| Closing soon | `--st-closing` | `#92400E` | `#FBBF24` | ⏳ hourglass | "Closing soon · 6 days left" |
| Opening soon | `--st-opening` | `#075985` | `#38BDF8` | ◷ clock | "Opens 1 Dec" |
| Closed | `--st-closed` | `#4B5563` | `#9CA3AF` | ○ outline circle | "Closed · next intake Apr" |
| Unknown | `--st-unknown` | `#9CA3AF` dashed | `#4B5563` dashed | ? | "Dates not published" |

All status text/background pairs must reach ≥ 4.5:1 contrast (verified by the axe scan in `e2e/a11y.spec.ts`; values darkened in Phase 3 to pass on 12 % tints); badges use a 12 % tint background with full-strength text.

**Field colours** (chips & field badges only — map pins use status colours, not field colours):
Engineering `#2563EB` · Computer Science `#7C3AED` · Business & Economics `#0D9488` · Natural Sciences `#16A34A`* · Medicine & Health `#DC2626`* · Social Sciences `#DB2777` · Law `#92400E` · Arts & Design `#C026D3` · Humanities `#9333EA` · Education `#EA580C` · Agriculture & Environment `#65A30D` · Architecture `#475569`.
*Field badges always include the field icon + name, so overlap with status hues is not ambiguous; field colours appear only as a 4 px left accent or chip dot.

### 3.2 Typography
| Role | Font | Size / line-height |
|---|---|---|
| Display / H1 | **Plus Jakarta Sans** 700 | 32/40 (mobile 26/34) |
| H2 | Plus Jakarta Sans 700 | 24/32 |
| H3 | Plus Jakarta Sans 600 | 18/26 |
| Body | **Inter** 400 | 16/24 |
| Small | Inter 500 | 14/20 |
| Caption / badge | Inter 600 | 12/16, letter-spacing 0.01em |
| Numbers (countdowns, fees) | Inter, `font-variant-numeric: tabular-nums` | — |
| SOP editor & exports | **Source Serif 4** 400 | 17/28 (editor), 11 pt (DOCX/PDF) |

Self-hosted, Latin subset, `font-display: swap`.

### 3.3 Spacing, radius, elevation, motion
- Spacing scale (px): 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Page gutter 16 mobile / 24 tablet / 32 desktop.
- Radius: 6 (inputs, badges) · 10 (buttons) · 14 (cards) · 20 (sheets/dialogs).
- Elevation: `sm` 0 1px 2px rgb(16 24 40 / .06) · `md` 0 4px 12px rgb(16 24 40 / .08) · `lg` 0 12px 32px rgb(16 24 40 / .12). Dark mode uses borders instead of shadows.
- Motion: 150 ms (hover), 200 ms ease-out (sheets, popups), 600 ms pulse on "Closing soon" pins (2 cycles then stops). Respect `prefers-reduced-motion`.
- Breakpoints: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280.

## 4. Layout

- **Desktop (≥ 1024):** 240 px sidebar nav · content max-width 1200 px · Explore uses filter rail (280 px) + results. Map is full-bleed with floating filter bar and a 360 px side list.
- **Tablet (768–1023):** collapsible sidebar; filters in drawer.
- **Mobile (< 768):** top bar + bottom tab bar (64 px, safe-area aware); filters in full-height sheet; map with bottom sheet (peek 30 % / half / full).

## 5. Key components

| Component | Spec |
|---|---|
| **StatusBadge** | Icon + label + optional countdown; sizes sm/md; tinted background; `aria-label` with full sentence ("Open now, closes 15 January, 21 days left"). |
| **ProgramCard** | 4 px field-colour left accent; title (2-line clamp); university · city; StatusBadge + countdown; chips: degree, language, intake; requirement icons (IELTS score, MOI ✓/✗, VPD, NC); actions: ★ Save (icon toggle), Compare checkbox; whole card clickable. |
| **ProgramRow** (desktop table) | Same data in columns; sticky header; status column first. |
| **FilterBar / FilterSheet** | Chips for top filters (Field, Status, Language, Intake); "More filters (n)" opens sheet; active filter chips are removable; live result count on Apply button ("Show 37 programs"). |
| **FieldChip** | Field icon + name + colour dot; multi-select; selected = filled tint + check. |
| **MapPin** | 32 px teardrop `divIcon`; fill = status colour; white status glyph inside; top-right badge = open count; selected pin scales 1.15 with ring. |
| **ClusterPin** | Circle 36–52 px by count; fill = most urgent child status; count in centre; thin ring segments showing status mix. |
| **MapPopup** | Width 320 px; header: university, city, QS rank; grouped program list by status (max 5, "+3 more" link); each row: name, intake, portal, StatusBadge + countdown, icons, actions (★, Details, Apply ↗, Write SOP); footer: "Dates last verified 12 Oct 2026 · Report". |
| **MapLegend** | Collapsible; status keys with counts for current filters. |
| **SummaryBar** | "12 programs open now at 9 universities" — sticky on map and explore. |
| **Wizard** | Step header with progress (1–5), one question group per screen on mobile, helper text with example answers, "Skip — add later" for optional items. |
| **SOPEditor** | Serif paper-like canvas (max 720 px); section headers as subtle labels (not printed in export); placeholder tokens highlighted amber; right sidebar (desktop) / tab (mobile) for Hints, Versions, Export; section hover toolbar: Regenerate · More specific · Shorten · More formal. |
| **KanbanBoard** | Columns with counts; cards show deadline countdown; drag + keyboard move (menu "Move to…"). |
| **EmptyState** | Simple line illustration, one sentence, one primary action. |
| **Toast** | Bottom-centre mobile, bottom-right desktop; with undo for Save/Unsave. |
| **Buttons** | Primary (filled indigo), Secondary (outline), Ghost, Danger; height 40 (44 on touch). |

## 6. Map styling

- Base tiles: CARTO Positron (light) / Dark Matter (dark) — muted so status pins stand out.
- Initial view: all of Germany (fit bounds), max zoom 13, min zoom 5.
- Germany outline subtle 1 px; neighbouring countries desaturated.
- Floating controls: Status chips (top), Field chips (below, horizontally scrollable), Legend (bottom-left), "List" toggle (top-right), Locate-me (optional).
- Closed programs are hidden by default (status chip "Open now"); in "All" they appear at 50 % opacity.

## 7. Content guidelines

- Dates: `15 Jan 2027` (never ambiguous numeric formats); countdowns: "21 days left", "Closes today", "Opens tomorrow".
- Money: `€1,500 / semester`, "No tuition" for €0.
- Glossary tooltips: VPD, APS, MOI, NC, uni-assist, ECTS, blocked account, TestDaF, DSH.
- Always pair data with source: "Source: official program page · verified 12 Oct 2026".
- SOP disclaimer copy: "This is a starting draft built from your answers. Personalise it and check each university's requirements before submitting."

## 8. Accessibility checklist

- Contrast ≥ 4.5:1 text, ≥ 3:1 UI components and pins against tiles.
- Focus ring 2 px `--primary` + 2 px offset on all interactive elements.
- Touch targets ≥ 44 × 44 px.
- Map: every pin reachable via the synchronized list; popups are focus-trapped dialogs on mobile; `Esc` closes.
- Forms: visible labels, error text linked via `aria-describedby`.
- Live regions announce result counts and generation progress.

## 9. Deliverables (design)

1. Token file (`tokens.css`) — light & dark.
2. Component sheet (Storybook-style page in `/dev/components`, dev-only).
3. Mobile + desktop mockups: Home, Explore, Map (+ popup, bottom sheet), Program detail, My List (list + board), SOP wizard step, SOP editor, Admin queue.
4. Logo + favicon + PWA icons (192/512, maskable) + OG image template.
