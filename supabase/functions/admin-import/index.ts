/**
 * Admin CSV import: parse an uploaded CSV from the private `imports` bucket, validate each row,
 * resolve slugs, diff against existing programs and store the result for review.
 * Runs with the caller's JWT, so RLS (admin only) guards every read and write.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Papa from 'papaparse';
import { corsHeaders, HttpError, json, log, readJson } from '../_shared/http.ts';
import { importRowSchema, programSlug, type ImportRow } from '../_shared/submissions.ts';

const MAX_ROWS = 2000;

/** Columns compared to decide whether a row changes an existing program. */
const COMPARED = [
  'name',
  'degree_type',
  'teaching_language',
  'official_url',
  'application_url',
  'application_portal',
  'tuition_fee_eur',
  'tuition_note',
  'work_experience_years',
  'application_fee_eur',
  'ielts_min',
  'english_note',
  'german_level',
  'moi_accepted',
  'vpd_required',
  'nc_restricted',
  'gre_gmat',
  'entrance_exam_interview',
  'portfolio_required',
  'summary',
  'source_url',
  'last_verified_at',
  'university_id',
  'field_id',
] as const;

interface Lookups {
  universities: Map<string, string>;
  fields: Map<string, string>;
  specializations: Map<string, string>;
  programs: Map<string, Record<string, unknown>>;
}

async function loadLookups(db: SupabaseClient): Promise<Lookups> {
  const [u, f, s, p] = await Promise.all([
    db.from('universities').select('id, slug'),
    db.from('fields').select('id, slug'),
    db.from('specializations').select('id, slug'),
    db.from('programs').select('*'),
  ]);
  for (const r of [u, f, s, p])
    if (r.error) throw new HttpError(500, 'Could not load reference data');
  return {
    universities: new Map(u.data!.map((r) => [r.slug, r.id])),
    fields: new Map(f.data!.map((r) => [r.slug, r.id])),
    specializations: new Map(s.data!.map((r) => [r.slug, r.id])),
    programs: new Map(p.data!.map((r) => [r.slug as string, r])),
  };
}

function toPayload(row: ImportRow, lk: Lookups, errors: string[]) {
  const university_id = lk.universities.get(row.university_slug);
  if (!university_id) errors.push(`Unknown university_slug "${row.university_slug}"`);
  const field_id = lk.fields.get(row.field_slug);
  if (!field_id) errors.push(`Unknown field_slug "${row.field_slug}"`);
  const specialization_ids = (row.specialization_slugs ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((slug) => {
      const id = lk.specializations.get(slug);
      if (!id) errors.push(`Unknown specialization "${slug}"`);
      return id;
    })
    .filter((id): id is string => Boolean(id));

  const intakes = (['winter', 'summer'] as const)
    .filter((season) => row[`${season}_year`] || row[`${season}_start`] || row[`${season}_end`])
    .map((season) => {
      const start = row[`${season}_start`] ?? null;
      const end = row[`${season}_end`] ?? null;
      if (!row[`${season}_year`])
        errors.push(`${season}_year is required when ${season} dates are given`);
      if (start && end && start > end) errors.push(`${season}_start is after ${season}_end`);
      return {
        season,
        academic_year: row[`${season}_year`],
        application_start: start,
        application_end: end,
      };
    });

  const {
    specialization_slugs: _s,
    university_slug,
    field_slug: _f,
    winter_year: _wy,
    winter_start: _ws,
    winter_end: _we,
    summer_year: _sy,
    summer_start: _ss,
    summer_end: _se,
    ...columns
  } = row;
  return {
    ...columns,
    slug: row.slug ?? programSlug(university_slug, row.name, row.degree_type),
    university_id,
    field_id,
    state: 'published',
    specialization_ids,
    intakes,
  };
}

function differs(payload: Record<string, unknown>, existing: Record<string, unknown>): boolean {
  return COMPARED.some((k) => {
    // Blank cells mean "leave as is" (they are not sent on apply), so they never count as a change.
    if (payload[k] === undefined) return false;
    const a = payload[k] ?? null;
    const b = existing[k] ?? null;
    return typeof b === 'number' || typeof a === 'number' ? Number(a) !== Number(b) : a !== b;
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) throw new HttpError(401, 'Sign in required');
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: isAdmin } = await db.rpc('is_admin');
    if (isAdmin !== true) throw new HttpError(403, 'Admins only');

    const { filePath } = (await readJson(req)) as { filePath?: string };
    if (typeof filePath !== 'string' || !filePath.endsWith('.csv'))
      throw new HttpError(400, 'filePath must be a .csv');

    const file = await db.storage.from('imports').download(filePath);
    if (file.error) throw new HttpError(404, 'Uploaded file not found');
    const parsed = Papa.parse<Record<string, string>>(await file.data.text(), {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
    });
    if (parsed.data.length === 0) throw new HttpError(400, 'The CSV has no rows');
    if (parsed.data.length > MAX_ROWS)
      throw new HttpError(400, `Split files over ${MAX_ROWS} rows`);

    const lookups = await loadLookups(db);
    const seenSlugs = new Set<string>();
    const rows = parsed.data.map((raw, i) => {
      const result = importRowSchema.safeParse(raw);
      if (!result.success) {
        const errors = result.error.issues.map(
          (iss) => `${iss.path.join('.') || 'row'}: ${iss.message}`,
        );
        return {
          row_number: i + 2,
          raw,
          parsed: null,
          action: 'error',
          target_program_id: null,
          errors,
        };
      }
      const errors: string[] = [];
      const payload = toPayload(result.data, lookups, errors);
      if (seenSlugs.has(payload.slug))
        errors.push(`Duplicate program "${payload.slug}" in this file`);
      seenSlugs.add(payload.slug);
      const existing = lookups.programs.get(payload.slug);
      const action = errors.length
        ? 'error'
        : !existing
          ? 'new'
          : differs(payload, existing)
            ? 'update'
            : 'unchanged';
      return {
        row_number: i + 2, // header is line 1
        raw,
        parsed: payload,
        action,
        target_program_id: (existing?.id as string | undefined) ?? null,
        errors,
      };
    });

    const { data: batch, error: batchError } = await db
      .from('import_batches')
      .insert({ file_path: filePath, row_count: rows.length })
      .select('id')
      .single();
    if (batchError) throw new HttpError(500, 'Could not create import batch');
    const { error: rowsError } = await db
      .from('import_rows')
      .insert(rows.map((r) => ({ ...r, batch_id: batch.id })));
    if (rowsError) throw new HttpError(500, 'Could not store import rows');

    const counts = rows.reduce<Record<string, number>>(
      (c, r) => ({ ...c, [r.action]: (c[r.action] ?? 0) + 1 }),
      {},
    );
    log('import.parsed', { rows: rows.length, ...counts });
    return json(req, { batchId: batch.id, counts });
  } catch (err) {
    if (err instanceof HttpError) return json(req, { error: err.message }, err.status);
    log('import.error', { message: String(err) });
    return json(req, { error: 'Import failed' }, 500);
  }
});
