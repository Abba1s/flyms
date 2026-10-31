# Research batches

Program data collected from **official university pages**, in the admin CSV import format
(`Admin → Imports`). Each row has a `source_url` and `last_verified_at`. Fields not stated on the
official page are left blank rather than guessed; blank cells never overwrite existing data.

## batch-01.csv — 31 Oct 2026 (10 programs, 10 fields)

| Field                     | Program                                                         | Notes                                                                  |
| ------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Engineering               | TUM — M.Sc. Mechanical Engineering                              | German & English; €6,000/semester non-EU tuition                       |
| Business                  | Mannheim — Mannheim Master in Management                        | 2027/28 dates not yet confirmed (page inconsistent) — dates left blank |
| Natural Sciences          | Bonn — M.Sc. Physics                                            | Non-EU deadline 1 May; start of window not stated                      |
| Medicine & Health         | Heidelberg — M.Sc. International Health                         | Deadline 31 Mar 2027; €14,100 for the 1-year programme                 |
| Social Sciences           | Erfurt — Master of Public Policy                                | Visa applicants: 30 Apr 2027 (priority 28 Feb)                         |
| Law                       | Saarland (Europa-Institut) — LL.M. European & International Law | Deadline 15 Jul; €3,400/semester                                       |
| Arts & Design             | Anhalt — M.A. Integrated Design                                 | uni-assist; 12 months' work experience required                        |
| Humanities                | Göttingen — M.A. Modern Indian Studies                          | Non-EU window 6 Oct – 15 Nov 2026; IELTS 7.0; MOI not accepted         |
| Agriculture & Environment | Hohenheim — M.Sc. AgriTropics                                   | Opens "mid-November" (entered as 15 Nov); deadline 15 Mar 2027         |
| Architecture              | Stuttgart — M.Sc. IUSD                                          | Window 1 Jun – 15 Oct of the year before start                         |

**Not found:** no English-taught Education master with dates confirmed on an official page
(candidates checked at Bamberg and Tübingen require German).

**Rejected during research** (still listed on aggregator sites):

- Freiburg — M.Sc. Renewable Energy Engineering and Management: discontinued since winter 2023/24.
- Bauhaus-Universität Weimar — MFA Public Art and New Artistic Strategies: being phased out; no new admissions.

New universities added to `supabase/seed/universities.csv` (coordinates from OpenStreetMap
Nominatim): University of Hohenheim, Technical University of Munich, University of Erfurt,
Anhalt University of Applied Sciences.
