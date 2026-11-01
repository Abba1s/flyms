import { closingBucket, isOpen, type IntakeStatus } from '@flyms/shared';
import MiniSearch from 'minisearch';
import type { ProgramWithStatus } from './api';

/** `closing` is the 15-day bucket; `closing3`/`closing7` are its narrower slices. */
export type StatusFilter =
  'open' | 'closing3' | 'closing7' | 'closing' | 'opening' | 'closed' | 'all';
export const STATUS_FILTERS: readonly StatusFilter[] = [
  'open',
  'closing3',
  'closing7',
  'closing',
  'opening',
  'closed',
  'all',
];
export type SortKey = 'deadline' | 'qs' | 'tuition' | 'name';
export type TriState = 'yes' | 'no' | 'any';

export interface Filters {
  q: string;
  fields: string[];
  specs: string[];
  status: StatusFilter;
  intake: 'winter' | 'summer' | 'any';
  lang: 'english' | 'german' | 'any';
  degrees: string[];
  university: string;
  city: string;
  freeTuition: boolean;
  ieltsMax: number | null;
  moi: TriState;
  vpd: TriState;
  nc: TriState;
  sort: SortKey;
  dir: 'asc' | 'desc';
  page: number;
  size: number;
  /** Evaluate admission status on this date instead of today ('' = today). */
  asOf: string;
}

export const PAGE_SIZES = [12, 24, 48, 96];

export const DEFAULT_FILTERS: Filters = {
  q: '',
  fields: [],
  specs: [],
  status: 'all',
  intake: 'any',
  lang: 'any',
  degrees: [],
  university: '',
  city: '',
  freeTuition: false,
  ieltsMax: null,
  moi: 'any',
  vpd: 'any',
  nc: 'any',
  sort: 'deadline',
  dir: 'asc',
  page: 1,
  size: 24,
  asOf: '',
};

/** The map opens on "Open now" (FR-13). */
export const MAP_DEFAULTS: Filters = { ...DEFAULT_FILTERS, status: 'open' };

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const oneOf = <T extends string>(v: string | null, options: readonly T[], fallback: T): T =>
  options.includes(v as T) ? (v as T) : fallback;
const tri = (v: string | null): TriState => oneOf(v, ['yes', 'no', 'any'] as const, 'any');
const positiveInt = (v: string | null, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** Parse URL search params; anything invalid falls back to `defaults`. */
export function parseFilters(
  params: URLSearchParams,
  defaults: Filters = DEFAULT_FILTERS,
): Filters {
  const ielts = Number(params.get('ielts'));
  return {
    q: params.get('q') ?? defaults.q,
    fields: params.has('field') ? list(params.get('field')) : defaults.fields,
    specs: params.has('spec') ? list(params.get('spec')) : defaults.specs,
    status: oneOf(params.get('status'), STATUS_FILTERS, defaults.status),
    intake: oneOf(params.get('intake'), ['winter', 'summer', 'any'] as const, defaults.intake),
    lang: oneOf(params.get('lang'), ['english', 'german', 'any'] as const, defaults.lang),
    degrees: params.has('degree') ? list(params.get('degree')) : defaults.degrees,
    university: params.get('uni') ?? defaults.university,
    city: params.get('city') ?? defaults.city,
    freeTuition: params.has('free') ? params.get('free') === '1' : defaults.freeTuition,
    ieltsMax: params.has('ielts') && ielts > 0 && ielts <= 9 ? ielts : defaults.ieltsMax,
    moi: params.has('moi') ? tri(params.get('moi')) : defaults.moi,
    vpd: params.has('vpd') ? tri(params.get('vpd')) : defaults.vpd,
    nc: params.has('nc') ? tri(params.get('nc')) : defaults.nc,
    sort: oneOf(params.get('sort'), ['deadline', 'qs', 'tuition', 'name'] as const, defaults.sort),
    dir: oneOf(params.get('dir'), ['asc', 'desc'] as const, defaults.dir),
    page: positiveInt(params.get('page'), defaults.page),
    size: PAGE_SIZES.includes(Number(params.get('size')))
      ? Number(params.get('size'))
      : defaults.size,
    asOf: /^\d{4}-\d{2}-\d{2}$/.test(params.get('on') ?? '') ? params.get('on')! : defaults.asOf,
  };
}

/** Serialise only values that differ from `defaults`, keeping URLs short and shareable. */
export function serializeFilters(f: Filters, defaults: Filters = DEFAULT_FILTERS): URLSearchParams {
  const p = new URLSearchParams();
  const setIf = (key: string, value: string, def: string) => {
    if (value !== def) p.set(key, value);
  };
  setIf('q', f.q.trim(), defaults.q);
  setIf('field', f.fields.join(','), defaults.fields.join(','));
  setIf('spec', f.specs.join(','), defaults.specs.join(','));
  setIf('status', f.status, defaults.status);
  setIf('intake', f.intake, defaults.intake);
  setIf('lang', f.lang, defaults.lang);
  setIf('degree', f.degrees.join(','), defaults.degrees.join(','));
  setIf('uni', f.university, defaults.university);
  setIf('city', f.city, defaults.city);
  setIf('free', f.freeTuition ? '1' : '0', defaults.freeTuition ? '1' : '0');
  setIf(
    'ielts',
    f.ieltsMax === null ? '' : String(f.ieltsMax),
    defaults.ieltsMax === null ? '' : String(defaults.ieltsMax),
  );
  setIf('moi', f.moi, defaults.moi);
  setIf('vpd', f.vpd, defaults.vpd);
  setIf('nc', f.nc, defaults.nc);
  setIf('sort', f.sort, defaults.sort);
  setIf('dir', f.dir, defaults.dir);
  setIf('page', String(f.page), String(defaults.page));
  setIf('size', String(f.size), String(defaults.size));
  setIf('on', f.asOf, defaults.asOf);
  return p;
}

/** Filters other than paging/sorting that are active — used for "More filters (n)". */
export function countActiveFilters(f: Filters, defaults: Filters = DEFAULT_FILTERS): number {
  const keys: (keyof Filters)[] = [
    'specs',
    'intake',
    'lang',
    'degrees',
    'university',
    'city',
    'freeTuition',
    'ieltsMax',
    'moi',
    'vpd',
    'nc',
  ];
  return keys.filter((k) => JSON.stringify(f[k]) !== JSON.stringify(defaults[k])).length;
}

export function matchesStatus(s: IntakeStatus, filter: StatusFilter): boolean {
  const bucket = s.status === 'closing_soon' ? closingBucket(s.daysLeft) : null;
  switch (filter) {
    case 'open':
      return isOpen(s.status);
    case 'closing3':
      return bucket === 3;
    case 'closing7':
      return bucket === 3 || bucket === 7;
    case 'closing':
      return bucket !== null;
    case 'opening':
      // Upcoming intake: closed now, with a known future start date.
      return s.status === 'opening_soon' || (s.status === 'closed' && s.daysUntilOpen !== null);
    case 'closed':
      return s.status === 'closed' && s.daysUntilOpen === null;
    case 'all':
      return true;
  }
}

function matchesTri(value: boolean | null, filter: TriState): boolean {
  if (filter === 'any') return true;
  return value === (filter === 'yes');
}

export function buildSearchIndex(programs: ProgramWithStatus[]): MiniSearch<ProgramWithStatus> {
  const index = new MiniSearch<ProgramWithStatus>({
    fields: ['name', 'university_name', 'city', 'specs'],
    extractField: (doc, field) =>
      field === 'specs'
        ? doc.specialization_slugs.join(' ').replaceAll('-', ' ')
        : String(doc[field as keyof ProgramWithStatus] ?? ''),
    searchOptions: { prefix: true, fuzzy: 0.2, boost: { name: 2 }, combineWith: 'AND' },
  });
  index.addAll(programs);
  return index;
}

/** Apply every filter except `status` — the map needs per-status counts of this set. */
export function applyNonStatusFilters(
  programs: ProgramWithStatus[],
  f: Filters,
  index?: MiniSearch<ProgramWithStatus>,
): ProgramWithStatus[] {
  let result = programs;
  const q = f.q.trim();
  if (q && index) {
    const hits = new Set(index.search(q).map((h) => h.id as string));
    result = result.filter((p) => hits.has(p.id));
  }
  return result.filter(
    (p) =>
      (f.fields.length === 0 || f.fields.includes(p.field_slug)) &&
      (f.specs.length === 0 || p.specialization_slugs.some((s) => f.specs.includes(s))) &&
      (f.intake === 'any' || p.intakes.some((i) => i.season === f.intake)) &&
      (f.lang === 'any' ||
        p.teaching_language === f.lang ||
        p.teaching_language === 'english_german') &&
      (f.degrees.length === 0 || f.degrees.includes(p.degree_type)) &&
      (!f.university || p.university_slug === f.university) &&
      (!f.city || p.city === f.city) &&
      (!f.freeTuition || p.tuition_fee_eur === 0) &&
      (f.ieltsMax === null || p.ielts_min === null || p.ielts_min <= f.ieltsMax) &&
      matchesTri(p.moi_accepted, f.moi) &&
      matchesTri(p.vpd_required, f.vpd) &&
      matchesTri(p.nc_restricted, f.nc),
  );
}

export function applyFilters(
  programs: ProgramWithStatus[],
  f: Filters,
  index?: MiniSearch<ProgramWithStatus>,
): ProgramWithStatus[] {
  return applyNonStatusFilters(programs, f, index).filter((p) => matchesStatus(p.status, f.status));
}

/** Days until the next relevant date; programs without one sort last. */
function deadlineKey(p: ProgramWithStatus): number {
  const s = p.status;
  if (s.daysLeft !== null) return s.daysLeft;
  if (s.daysUntilOpen !== null) return 10_000 + s.daysUntilOpen;
  return Number.POSITIVE_INFINITY;
}

export function sortPrograms(programs: ProgramWithStatus[], sort: SortKey, dir: 'asc' | 'desc') {
  const key: Record<SortKey, (p: ProgramWithStatus) => number | string> = {
    deadline: deadlineKey,
    qs: (p) => p.qs_ranking_sort ?? Number.POSITIVE_INFINITY,
    tuition: (p) => p.tuition_fee_eur ?? Number.POSITIVE_INFINITY,
    name: (p) => p.name.toLowerCase(),
  };
  const sign = dir === 'asc' ? 1 : -1;
  return [...programs].sort((a, b) => {
    const ka = key[sort](a);
    const kb = key[sort](b);
    // Missing values always last, whatever the direction.
    if (ka === Number.POSITIVE_INFINITY && kb !== Number.POSITIVE_INFINITY) return 1;
    if (kb === Number.POSITIVE_INFINITY && ka !== Number.POSITIVE_INFINITY) return -1;
    if (ka < kb) return -sign;
    if (ka > kb) return sign;
    return a.name.localeCompare(b.name);
  });
}
