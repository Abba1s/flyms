/**
 * Sync application deadlines from DAAD's international programmes database.
 *
 * 1. Fetch every master's course DAAD lists (about 18 pages of 100).
 * 2. Link programs to DAAD courses when the name and city match exactly one course.
 * 3. For each linked program, compare DAAD's next deadline with the stored intakes:
 *    same date → verified; moved within 60 days → updated; anything else → flagged for review.
 *    Programs imported from DAAD follow DAAD directly (no review queue).
 * 4. Import DAAD courses whose deadline is still ahead and that we don't list yet, creating
 *    their universities when needed. They are published straight away with origin 'daad'.
 *
 * Hochschulkompass blocks automated access, so its links are checked by hand in the admin.
 * Callable by an admin (JWT) or by pg_cron with the `x-cron-secret` header.
 */
import { createClient } from '@supabase/supabase-js';
import {
  canonicalCity,
  durationSemesters,
  findUniversity,
  inferDegree,
  inferIntake,
  programSlug,
  slugify,
  subjectToField,
  teachingLanguage,
  tuition,
  universityType,
  type UniversityRef,
} from '../_shared/daadImport.ts';
import {
  findCourseMatch,
  normalizeName,
  indexCoursesByName,
  parseDaadDeadline,
  plainText,
  reconcileDeadline,
  type SyncIntake,
} from '../_shared/deadlines.ts';
import { corsHeaders, HttpError, json, log } from '../_shared/http.ts';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const DAAD_ORIGIN = 'https://www2.daad.de';
const DAAD_SEARCH = `${DAAD_ORIGIN}/deutschland/studienangebote/international-programmes/api/solr/en/search.json`;
const PAGE_SIZE = 100;
const MAX_PAGES = 40;
const PAGE_DELAY_MS = 400;
const USER_AGENT =
  'UTEC-DeadlineSync/1.0 (+https://flyms.vercel.app; checks application deadlines twice a day)';

interface DaadCourse {
  id: number;
  courseName: string;
  academy: string;
  city: string;
  applicationDeadline: string | null;
  link: string;
  subject: string | null;
  languages: string[];
  beginning: string | null;
  programmeDuration: string | null;
  tuitionFees: string | null;
  isElearning: boolean;
}

const daadUrl = (c: DaadCourse) => DAAD_ORIGIN + c.link;
const INTAKE_NOTE = 'Opening date not listed on DAAD — check the university page before applying.';
const BATCH = 200;

async function authorize(req: Request) {
  const secret = Deno.env.get('DEADLINE_SYNC_SECRET');
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

async function fetchDaadCourses(): Promise<Map<string, DaadCourse>> {
  const courses = new Map<string, DaadCourse>();
  let total = Infinity;
  for (let page = 0; page < MAX_PAGES && page * PAGE_SIZE < total; page++) {
    const url = new URL(DAAD_SEARCH);
    url.searchParams.set('q', '');
    url.searchParams.append('degree[]', '2'); // master's
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(page * PAGE_SIZE));
    url.searchParams.set('display', 'list');
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`DAAD returned HTTP ${res.status} on page ${page + 1}`);
    const body = (await res.json()) as { numResults: number; courses: DaadCourse[] };
    total = body.numResults;
    for (const c of body.courses) courses.set(String(c.id), c);
    if (body.courses.length === 0) break;
    await new Promise((r) => setTimeout(r, PAGE_DELAY_MS));
  }
  // A short read means DAAD changed or failed; don't treat missing courses as delisted.
  if (courses.size < Math.min(total, 200)) {
    throw new Error(`DAAD returned only ${courses.size} of ${total} courses`);
  }
  return courses;
}

interface ProgramRow {
  id: string;
  name: string;
  origin: 'manual' | 'daad';
  university_id: string;
  universities: { name: string; short_name: string | null; city: string } | null;
  program_intakes: {
    id: string;
    season: string;
    academic_year: string;
    application_start: string | null;
    application_end: string | null;
  }[];
  program_sources: {
    id: string;
    source: string;
    external_id: string | null;
    auto_sync: boolean;
    last_status: string | null;
    last_raw: string | null;
    last_parsed_end: string | null;
  }[];
}

/** Link unlinked programs to the single DAAD course with the same name at the same university. */
async function autoLink(programs: ProgramRow[], courses: Map<string, DaadCourse>): Promise<number> {
  const linkedIds = new Set(
    programs.flatMap((p) =>
      p.program_sources
        .filter((s) => s.source === 'daad' && s.external_id)
        .map((s) => s.external_id!),
    ),
  );
  const byName = indexCoursesByName(
    [...courses.values()].map((c) => ({
      id: String(c.id),
      name: c.courseName,
      institution: c.academy,
      city: c.city,
    })),
  );
  let linked = 0;
  for (const p of programs) {
    if (!p.universities || p.program_sources.some((s) => s.source === 'daad')) continue;
    const match = findCourseMatch(
      { name: p.name, university: p.universities.name, city: p.universities.city },
      byName,
    );
    if (!match || linkedIds.has(match.id)) continue;
    const c = courses.get(match.id)!;
    const { data, error } = await admin
      .from('program_sources')
      .insert({
        program_id: p.id,
        source: 'daad',
        external_id: String(c.id),
        url: DAAD_ORIGIN + c.link,
        matched_by: 'auto',
      })
      .select('id, source, external_id, auto_sync, last_status, last_raw, last_parsed_end')
      .single();
    if (error) {
      log('deadlines.autolink_failed', { program_id: p.id, message: error.message });
      continue;
    }
    p.program_sources.push(data);
    linkedIds.add(String(c.id));
    linked++;
  }
  return linked;
}

function berlinToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
}

async function check<T>(p: PromiseLike<{ error: { message: string } | null; data?: T }>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

/** Read every row of a query past PostgREST's 1,000-row cap. */
async function selectAll<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

interface GeoCity {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

const MAX_GEOCODES_PER_RUN = 10;

/** Look a German city up on OpenStreetMap (≤ 1 request per second, per their usage policy). */
async function geocode(city: string): Promise<GeoCity | null> {
  const name = city.split(/\s*\(|\s+\/\s+/)[0]!.trim();
  const url = new URL('https://nominatim.openstreetmap.org/search');
  for (const [k, v] of Object.entries({
    city: name,
    country: 'Germany',
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    'accept-language': 'en',
  }))
    url.searchParams.set(k, v);
  await new Promise((r) => setTimeout(r, 1100));
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as {
      lat: string;
      lon: string;
      address?: { state?: string; city?: string };
    }[];
    if (!hit) return null;
    const lat = Math.round(Number(hit.lat) * 1e6) / 1e6;
    const lng = Math.round(Number(hit.lon) * 1e6) / 1e6;
    const state = hit.address?.state ?? hit.address?.city;
    if (!state || lat < 47 || lat > 56 || lng < 5 || lng > 16) return null;
    return { city, state, lat, lng };
  } catch {
    return null;
  }
}

/**
 * Add DAAD courses with an upcoming deadline that we don't list yet. Returns counts.
 * Courses are skipped when their subject, language or location can't be mapped.
 */
async function importNew(
  courses: Map<string, DaadCourse>,
  programs: ProgramRow[],
  today: string,
): Promise<{ imported: number; universitiesCreated: number; skipped: number; linked: number }> {
  const linkedIds = new Set(
    programs.flatMap((p) =>
      p.program_sources
        .filter((s) => s.source === 'daad' && s.external_id)
        .map((s) => s.external_id!),
    ),
  );
  const candidates: { course: DaadCourse; end: string }[] = [];
  for (const c of courses.values()) {
    if (linkedIds.has(String(c.id)) || c.isElearning) continue;
    const parsed = parseDaadDeadline(c.applicationDeadline);
    if (parsed.kind === 'date' && parsed.date >= today)
      candidates.push({ course: c, end: parsed.date });
  }
  if (candidates.length === 0)
    return { imported: 0, universitiesCreated: 0, skipped: 0, linked: 0 };

  const [universities, fields, geoRows, slugRows] = await Promise.all([
    selectAll<UniversityRef & { slug: string }>((a, b) =>
      admin
        .from('universities')
        .select('id, slug, name, short_name, city, daad_name')
        .is('deleted_at', null)
        .range(a, b),
    ),
    selectAll<{ id: string; slug: string }>((a, b) =>
      admin.from('fields').select('id, slug').range(a, b),
    ),
    selectAll<GeoCity>((a, b) =>
      admin.from('geo_cities').select('city, state, lat, lng').range(a, b),
    ),
    selectAll<{ slug: string }>((a, b) => admin.from('programs').select('slug').range(a, b)),
  ]);
  const fieldIds = new Map(fields.map((f) => [f.slug, f.id]));
  const geo = new Map(geoRows.map((g) => [g.city, g]));
  const programSlugs = new Set(slugRows.map((r) => r.slug));
  const uniSlugs = new Set(universities.map((u) => u.slug));
  const existingNames = new Map<string, string>(); // `${university_id}|${normalized name}` → program id
  for (const p of programs) existingNames.set(`${p.university_id}|${normalizeName(p.name)}`, p.id);

  // ── Universities: match existing ones, create the rest ──
  const byAcademy = new Map<string, DaadCourse[]>();
  for (const { course } of candidates) {
    byAcademy.set(course.academy, [...(byAcademy.get(course.academy) ?? []), course]);
  }
  const uniFor = new Map<string, { id: string; slug: string }>();
  const newUnis: Record<string, unknown>[] = [];
  let geocodes = 0;
  for (const [academy, list] of byAcademy) {
    const match = findUniversity(academy, list[0]!.city, universities);
    if (match) {
      uniFor.set(academy, match);
      continue;
    }
    // Use the city with the most courses that we can place on the map.
    const cities = [...new Set(list.map((c) => c.city))].sort(
      (a, b) => list.filter((c) => c.city === b).length - list.filter((c) => c.city === a).length,
    );
    let place: GeoCity | undefined;
    for (const city of cities) {
      place = geo.get(city);
      if (place) break;
    }
    if (!place) {
      for (const city of cities) {
        if (geocodes >= MAX_GEOCODES_PER_RUN) break;
        geocodes++;
        const found = await geocode(city);
        if (found) {
          await admin.from('geo_cities').upsert(found, { onConflict: 'city' });
          geo.set(city, found);
          place = found;
          break;
        }
      }
    }
    if (!place) continue; // abroad or unknown; try again next run
    let slug = slugify(academy) || `university-${list[0]!.id}`;
    for (let n = 2; uniSlugs.has(slug); n++) slug = `${slugify(academy)}-${n}`;
    uniSlugs.add(slug);
    newUnis.push({
      slug,
      name: academy,
      type: universityType(academy),
      city: place.city.split(/\s*\(|\s+\/\s+/)[0]!.trim(),
      state: place.state,
      lat: place.lat,
      lng: place.lng,
      origin: 'daad',
      daad_name: academy,
    });
  }
  let universitiesCreated = 0;
  for (let i = 0; i < newUnis.length; i += BATCH) {
    const { data, error } = await admin
      .from('universities')
      .insert(newUnis.slice(i, i + BATCH))
      .select('id, slug, daad_name');
    if (error) throw new Error(`Could not create universities: ${error.message}`);
    for (const u of data) uniFor.set(u.daad_name!, { id: u.id, slug: u.slug });
    universitiesCreated += data.length;
  }

  // ── Programs ──
  let skipped = 0;
  let linked = 0;
  const rows: Record<string, unknown>[] = [];
  const pending = new Map<string, { course: DaadCourse; end: string }>(); // slug → source
  const links: Record<string, unknown>[] = [];
  for (const { course, end } of candidates) {
    const uni = uniFor.get(course.academy);
    const field = subjectToField(course.subject, course.courseName);
    const language = teachingLanguage(course.languages);
    if (!uni || !field || !language || !fieldIds.has(field)) {
      skipped++;
      continue;
    }
    // Already listed under the same name at that university → link instead of duplicating.
    const existing = existingNames.get(`${uni.id}|${normalizeName(course.courseName)}`);
    if (existing) {
      links.push({
        program_id: existing,
        source: 'daad',
        external_id: String(course.id),
        url: daadUrl(course),
        matched_by: 'auto',
      });
      linked++;
      continue;
    }
    const degree = inferDegree(course.courseName);
    let slug = programSlug(uni.slug, course.courseName, degree);
    if (programSlugs.has(slug)) slug = `${slug}-${course.id}`;
    programSlugs.add(slug);
    existingNames.set(`${uni.id}|${normalizeName(course.courseName)}`, slug);
    const fee = tuition(course.tuitionFees);
    rows.push({
      slug,
      university_id: uni.id,
      field_id: fieldIds.get(field),
      name: course.courseName.trim(),
      degree_type: degree,
      teaching_language: language,
      duration_semesters: durationSemesters(course.programmeDuration),
      official_url: daadUrl(course),
      source_url: daadUrl(course),
      tuition_fee_eur: fee.fee,
      tuition_note: fee.note,
      state: 'published',
      origin: 'daad',
      last_verified_at: today,
    });
    pending.set(slug, { course, end });
  }
  if (links.length > 0) {
    await check(
      admin
        .from('program_sources')
        .upsert(links, { onConflict: 'program_id,source', ignoreDuplicates: true }),
    );
  }

  let imported = 0;
  const now = new Date().toISOString();
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await admin
      .from('programs')
      .insert(rows.slice(i, i + BATCH))
      .select('id, slug');
    if (error) throw new Error(`Could not import programs: ${error.message}`);
    const intakes: Record<string, unknown>[] = [];
    const sources: Record<string, unknown>[] = [];
    for (const p of data) {
      const { course, end } = pending.get(p.slug)!;
      const { season, academicYear } = inferIntake(end, course.beginning);
      intakes.push({
        program_id: p.id,
        season,
        academic_year: academicYear,
        application_end: end,
        note: INTAKE_NOTE,
        verified_at: now,
        verified_source: 'daad',
      });
      sources.push({
        program_id: p.id,
        source: 'daad',
        external_id: String(course.id),
        url: daadUrl(course),
        matched_by: 'import',
        last_checked_at: now,
        last_status: 'ok',
        last_raw: plainText(course.applicationDeadline ?? ''),
        last_parsed_end: end,
      });
    }
    await check(admin.from('program_intakes').insert(intakes));
    await check(admin.from('program_sources').insert(sources));
    imported += data.length;
  }
  return { imported, universitiesCreated, skipped, linked };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  let runId: string | null = null;
  try {
    await authorize(req);
    const { data: run, error: runError } = await admin
      .from('deadline_sync_runs')
      .insert({ source: 'daad' })
      .select('id')
      .single();
    if (runError) throw new HttpError(500, 'Could not start run');
    runId = run.id;

    const courses = await fetchDaadCourses();

    const programs = await selectAll<ProgramRow>((from, to) =>
      admin
        .from('programs')
        .select(
          'id, name, origin, university_id, universities(name, short_name, city), program_intakes(id, season, academic_year, application_start, application_end), program_sources(id, source, external_id, auto_sync, last_status, last_raw, last_parsed_end)',
        )
        .is('deleted_at', null)
        .order('id')
        .range(from, to)
        .returns<ProgramRow[]>(),
    );

    const autoLinked = await autoLink(programs, courses);
    const today = berlinToday();
    const stats = { checked: 0, verified: 0, updated: 0, flagged: 0 };

    for (const p of programs) {
      const src = p.program_sources.find(
        (s) => s.source === 'daad' && s.auto_sync && s.external_id,
      );
      if (!src) continue;
      stats.checked++;
      const intakes: SyncIntake[] = p.program_intakes.map((i) => ({
        id: i.id,
        start: i.application_start,
        end: i.application_end,
      }));
      const upcoming = p.program_intakes
        .filter((i) => i.application_end === null || i.application_end >= today)
        .map((i) => i.id);

      /** Flag the program's upcoming intakes and record why, once per new piece of information. */
      const flag = async (
        intakeIds: string[],
        reason: string,
        raw: string | null,
        newEnd: string | null,
      ) => {
        if (intakeIds.length > 0) {
          await check(
            admin
              .from('program_intakes')
              .update({ needs_review: true, review_reason: reason })
              .in('id', intakeIds),
          );
        }
        await check(
          admin.from('deadline_changes').insert({
            run_id: runId,
            program_id: p.id,
            intake_id: intakeIds.length === 1 ? intakeIds[0] : null,
            source: 'daad',
            action: 'flagged',
            new_end: newEnd,
            reason,
            raw,
          }),
        );
        stats.flagged++;
      };

      const course = courses.get(src.external_id!);
      let status: string;
      let raw: string | null = null;
      let parsedEnd: string | null = null;

      const fromDaad = p.origin === 'daad';
      if (!course) {
        status = 'missing';
        if (src.last_status !== 'missing') {
          if (fromDaad) {
            // We only list it because DAAD did; hide it rather than queue it for review.
            await check(admin.from('programs').update({ state: 'draft' }).eq('id', p.id));
            await check(
              admin.from('deadline_changes').insert({
                run_id: runId,
                program_id: p.id,
                source: 'daad',
                action: 'applied',
                reason: 'Removed from DAAD — unpublished',
              }),
            );
            stats.updated++;
          } else {
            await flag(upcoming, 'Course no longer listed on DAAD', null, null);
          }
        }
      } else {
        raw = plainText(course.applicationDeadline ?? '');
        const parsed = parseDaadDeadline(course.applicationDeadline);
        if (parsed.kind !== 'date') {
          status = parsed.kind === 'none' ? 'no_deadline' : 'unparsed';
          if (raw !== src.last_raw && fromDaad) {
            // Imported programs: mark the deadline unverified on the site, without queueing.
            if (upcoming.length > 0) {
              await check(
                admin
                  .from('program_intakes')
                  .update({
                    needs_review: true,
                    review_reason: 'DAAD no longer lists a clear deadline',
                  })
                  .in('id', upcoming),
              );
            }
          } else if (raw !== src.last_raw) {
            const reason =
              parsed.kind === 'none'
                ? 'DAAD lists no deadline for this course'
                : 'DAAD deadline is free text and needs a manual check';
            await flag(upcoming, reason, raw, null);
          }
        } else {
          parsedEnd = parsed.date;
          const r = reconcileDeadline(intakes, parsed.date, {
            today,
            moreDeadlines: parsed.moreDeadlines,
          });
          const verifiedFields = {
            verified_at: new Date().toISOString(),
            verified_source: 'daad',
            needs_review: false,
            review_reason: null,
          };
          if (r.action === 'verify') {
            status = 'ok';
            await check(admin.from('program_intakes').update(verifiedFields).eq('id', r.intakeId));
            stats.verified++;
          } else if (r.action === 'update') {
            status = 'changed';
            await check(
              admin
                .from('program_intakes')
                .update({ ...verifiedFields, application_end: r.newEnd })
                .eq('id', r.intakeId),
            );
            await check(
              admin.from('deadline_changes').insert({
                run_id: runId,
                program_id: p.id,
                intake_id: r.intakeId,
                source: 'daad',
                action: 'applied',
                old_end: r.oldEnd,
                new_end: r.newEnd,
                reason: 'Deadline changed on DAAD',
                raw,
              }),
            );
            log('deadlines.updated', { program_id: p.id, from: r.oldEnd, to: r.newEnd });
            stats.updated++;
          } else if (fromDaad) {
            // Imported programs follow DAAD: move the matching intake or add the next cycle.
            if (parsed.date < today) {
              status = 'ok'; // stale listing; keep what we have
            } else {
              status = 'changed';
              const { season, academicYear } = inferIntake(parsed.date, course.beginning);
              const target =
                (r.intakeId && p.program_intakes.find((i) => i.id === r.intakeId)) ||
                p.program_intakes.find(
                  (i) => i.season === season && i.academic_year === academicYear,
                );
              if (target) {
                await check(
                  admin
                    .from('program_intakes')
                    .update({ ...verifiedFields, application_end: parsed.date })
                    .eq('id', target.id),
                );
              } else {
                await check(
                  admin.from('program_intakes').insert({
                    ...verifiedFields,
                    program_id: p.id,
                    season,
                    academic_year: academicYear,
                    application_end: parsed.date,
                    note: INTAKE_NOTE,
                  }),
                );
              }
              await check(
                admin.from('deadline_changes').insert({
                  run_id: runId,
                  program_id: p.id,
                  intake_id: target?.id ?? null,
                  source: 'daad',
                  action: 'applied',
                  old_end: target?.application_end ?? null,
                  new_end: parsed.date,
                  reason: target ? 'Deadline changed on DAAD' : 'New intake listed on DAAD',
                  raw,
                }),
              );
              stats.updated++;
            }
          } else {
            status = 'flagged';
            if (parsed.date !== src.last_parsed_end) {
              await flag(r.intakeId ? [r.intakeId] : [], r.reason, raw, parsed.date);
            }
          }
        }
      }

      await check(
        admin
          .from('program_sources')
          .update({
            last_checked_at: new Date().toISOString(),
            last_status: status,
            last_raw: raw,
            last_parsed_end: parsedEnd,
          })
          .eq('id', src.id),
      );
    }

    const added = await importNew(courses, programs, today);

    await check(
      admin
        .from('deadline_sync_runs')
        .update({
          finished_at: new Date().toISOString(),
          courses_fetched: courses.size,
          auto_linked: autoLinked + added.linked,
          imported: added.imported,
          universities_created: added.universitiesCreated,
          import_skipped: added.skipped,
          ...stats,
        })
        .eq('id', runId),
    );
    const summary = {
      courses: courses.size,
      autoLinked: autoLinked + added.linked,
      imported: added.imported,
      universitiesCreated: added.universitiesCreated,
      importSkipped: added.skipped,
      ...stats,
    };
    log('deadlines.synced', summary);
    return json(req, summary);
  } catch (err) {
    if (runId) {
      await admin
        .from('deadline_sync_runs')
        .update({ finished_at: new Date().toISOString(), error: String(err).slice(0, 500) })
        .eq('id', runId);
    }
    if (err instanceof HttpError) return json(req, { error: err.message }, err.status);
    log('deadlines.error', { message: String(err) });
    return json(req, { error: 'Deadline sync failed' }, 500);
  }
});
