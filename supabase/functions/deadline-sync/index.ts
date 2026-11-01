/**
 * Sync application deadlines from DAAD's international programmes database.
 *
 * 1. Fetch every master's course DAAD lists (about 18 pages of 100).
 * 2. Link programs to DAAD courses when the name and city match exactly one course.
 * 3. For each linked program, compare DAAD's next deadline with the stored intakes:
 *    same date → verified; moved within 60 days → updated; anything else → flagged for review.
 *
 * Hochschulkompass blocks automated access, so its links are checked by hand in the admin.
 * Callable by an admin (JWT) or by pg_cron with the `x-cron-secret` header.
 */
import { createClient } from '@supabase/supabase-js';
import {
  findCourseMatch,
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
}

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
  universities: { name: string; short_name: string | null; city: string } | null;
  program_intakes: {
    id: string;
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

    const { data: programs, error } = await admin
      .from('programs')
      .select(
        'id, name, universities(name, short_name, city), program_intakes(id, application_start, application_end), program_sources(id, source, external_id, auto_sync, last_status, last_raw, last_parsed_end)',
      )
      .is('deleted_at', null)
      .returns<ProgramRow[]>();
    if (error) throw new Error(`Could not load programs: ${error.message}`);

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

      if (!course) {
        status = 'missing';
        if (src.last_status !== 'missing') {
          await flag(upcoming, 'Course no longer listed on DAAD', null, null);
        }
      } else {
        raw = plainText(course.applicationDeadline ?? '');
        const parsed = parseDaadDeadline(course.applicationDeadline);
        if (parsed.kind !== 'date') {
          status = parsed.kind === 'none' ? 'no_deadline' : 'unparsed';
          if (raw !== src.last_raw) {
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

    await check(
      admin
        .from('deadline_sync_runs')
        .update({
          finished_at: new Date().toISOString(),
          courses_fetched: courses.size,
          auto_linked: autoLinked,
          ...stats,
        })
        .eq('id', runId),
    );
    log('deadlines.synced', { courses: courses.size, autoLinked, ...stats });
    return json(req, { courses: courses.size, autoLinked, ...stats });
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
