import { getProgramStatus, type PublicProgram } from '@flyms/shared';
import type { ProgramWithStatus } from './api';
import {
  DEFAULT_FILTERS,
  applyFilters,
  buildSearchIndex,
  countActiveFilters,
  parseFilters,
  serializeFilters,
  sortPrograms,
  type Filters,
} from './filters';

const TODAY = '2026-11-01';

function program(
  overrides: Partial<PublicProgram> & { id: string; name: string },
): ProgramWithStatus {
  const base: PublicProgram = {
    slug: overrides.id,
    degree_type: 'MSc',
    teaching_language: 'english',
    tuition_fee_eur: 0,
    application_fee_eur: null,
    ielts_min: null,
    moi_accepted: null,
    german_level: null,
    vpd_required: null,
    nc_restricted: null,
    gre_gmat: null,
    portfolio_required: false,
    application_portal: 'direct',
    official_url: 'https://example.org',
    application_url: null,
    last_verified_at: null,
    field_slug: 'computer-science',
    university_id: '00000000-0000-0000-0000-000000000001',
    university_slug: 'tu-berlin',
    university_name: 'TU Berlin',
    city: 'Berlin',
    german_state: 'Berlin',
    lat: 52.5,
    lng: 13.3,
    qs_ranking: null,
    qs_ranking_sort: null,
    specialization_slugs: [],
    intakes: [],
    ...overrides,
  };
  return { ...base, status: getProgramStatus(base.intakes, TODAY) };
}

const ai = program({
  id: 'ai',
  name: 'M.Sc. Artificial Intelligence',
  specialization_slugs: ['artificial-intelligence'],
  ielts_min: 6.5,
  moi_accepted: true,
  qs_ranking_sort: 150,
  intakes: [{ season: 'winter', year: '2027/28', start: '2026-10-01', end: '2026-11-05' }],
});
const mech = program({
  id: 'mech',
  name: 'M.Sc. Mechanical Engineering',
  field_slug: 'engineering',
  university_slug: 'tu-munich',
  university_name: 'TU Munich',
  city: 'Munich',
  teaching_language: 'german',
  tuition_fee_eur: 3000,
  qs_ranking_sort: 30,
  intakes: [{ season: 'summer', year: '2027', start: '2026-12-01', end: '2027-01-15' }],
});
const ds = program({
  id: 'ds',
  name: 'M.Sc. Data Science',
  specialization_slugs: ['data-science'],
  ielts_min: 7,
  moi_accepted: false,
  intakes: [{ season: 'summer', year: '2027', start: '2026-10-01', end: '2027-01-15' }],
});
const all = [ai, mech, ds];
const run = (f: Partial<Filters>) =>
  applyFilters(all, { ...DEFAULT_FILTERS, ...f }).map((p) => p.id);

describe('URL round-trip', () => {
  it('keeps default URLs empty', () => {
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe('');
  });

  it('round-trips every filter', () => {
    const f: Filters = {
      ...DEFAULT_FILTERS,
      q: 'data',
      fields: ['engineering', 'law'],
      specs: ['mechatronics'],
      status: 'open',
      intake: 'winter',
      lang: 'english',
      degrees: ['MSc', 'MBA'],
      university: 'tu-berlin',
      city: 'Berlin',
      freeTuition: true,
      ieltsMax: 6.5,
      moi: 'yes',
      vpd: 'no',
      nc: 'no',
      sort: 'qs',
      dir: 'desc',
      page: 3,
      size: 48,
      asOf: '2027-01-01',
    };
    expect(parseFilters(serializeFilters(f))).toEqual(f);
  });

  it('falls back on invalid values', () => {
    const f = parseFilters(new URLSearchParams('status=bogus&page=-2&size=7&ielts=12&moi=maybe'));
    expect(f).toEqual(DEFAULT_FILTERS);
  });

  it('respects page-specific defaults', () => {
    const mapDefaults = { ...DEFAULT_FILTERS, status: 'open' as const };
    expect(parseFilters(new URLSearchParams(''), mapDefaults).status).toBe('open');
    expect(serializeFilters(mapDefaults, mapDefaults).toString()).toBe('');
    expect(serializeFilters(DEFAULT_FILTERS, mapDefaults).get('status')).toBe('all');
  });
});

describe('applyFilters', () => {
  it('filters by status', () => {
    expect(run({ status: 'open' })).toEqual(['ai', 'ds']);
    expect(run({ status: 'closing' })).toEqual(['ai']);
    expect(run({ status: 'opening' })).toEqual(['mech']);
  });

  it('filters by field, specialization, intake and language', () => {
    expect(run({ fields: ['engineering'] })).toEqual(['mech']);
    expect(run({ specs: ['data-science', 'artificial-intelligence'] })).toEqual(['ai', 'ds']);
    expect(run({ intake: 'winter' })).toEqual(['ai']);
    expect(run({ lang: 'english' })).toEqual(['ai', 'ds']);
  });

  it('filters by requirements', () => {
    expect(run({ freeTuition: true })).toEqual(['ai', 'ds']);
    expect(run({ ieltsMax: 6.5 })).toEqual(['ai', 'mech']); // unknown IELTS is kept
    expect(run({ moi: 'yes' })).toEqual(['ai']);
    expect(run({ moi: 'no' })).toEqual(['ds']);
  });

  it('searches names, universities and specializations', () => {
    const index = buildSearchIndex(all);
    const q = (text: string) =>
      applyFilters(all, { ...DEFAULT_FILTERS, q: text }, index).map((p) => p.id);
    expect(q('munich')).toEqual(['mech']);
    expect(q('artif')).toEqual(['ai']);
    expect(q('data sci')).toEqual(['ds']);
  });

  it('counts active filters', () => {
    expect(countActiveFilters({ ...DEFAULT_FILTERS, moi: 'yes', ieltsMax: 7, q: 'x' })).toBe(2);
  });
});

describe('sortPrograms', () => {
  it('sorts by soonest deadline, open before upcoming', () => {
    expect(sortPrograms(all, 'deadline', 'asc').map((p) => p.id)).toEqual(['ai', 'ds', 'mech']);
  });

  it('puts missing values last in both directions', () => {
    expect(sortPrograms(all, 'qs', 'asc').map((p) => p.id)).toEqual(['mech', 'ai', 'ds']);
    expect(sortPrograms(all, 'qs', 'desc').map((p) => p.id)).toEqual(['ai', 'mech', 'ds']);
  });
});
