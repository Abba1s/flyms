import { academicYear, buildProgramPayload, mergeIntake, type IntakeRow } from './proposal';

const TODAY = '2026-11-01';
const choices = {
  university_id: 'u1',
  university_slug: 'tu-munich',
  field_id: 'f1',
  degree_type: 'MSc',
  teaching_language: 'english',
  publish: true,
};

describe('academicYear', () => {
  it('labels winter intakes as YYYY/YY', () => {
    expect(academicYear('winter', '2027-05-31', TODAY)).toBe('2027/28');
    expect(academicYear('winter', '2026-11-15', TODAY)).toBe('2027/28');
  });
  it('labels summer intakes by the semester year', () => {
    expect(academicYear('summer', '2027-01-15', TODAY)).toBe('2027');
    expect(academicYear('summer', '2026-08-15', TODAY)).toBe('2027');
  });
});

describe('mergeIntake', () => {
  it('replaces the same season and year and keeps others', () => {
    const current: IntakeRow[] = [
      {
        season: 'winter',
        academic_year: '2027/28',
        application_start: null,
        application_end: '2027-05-31',
      },
      {
        season: 'summer',
        academic_year: '2027',
        application_start: null,
        application_end: '2027-01-15',
      },
    ];
    const next: IntakeRow = {
      season: 'summer',
      academic_year: '2027',
      application_start: '2026-11-01',
      application_end: '2027-01-31',
    };
    const merged = mergeIntake(current, next);
    expect(merged).toHaveLength(2);
    expect(merged.find((i) => i.season === 'summer')?.application_end).toBe('2027-01-31');
    expect(merged.find((i) => i.season === 'winter')?.application_end).toBe('2027-05-31');
  });
});

describe('buildProgramPayload', () => {
  it('builds a complete new program', () => {
    const payload = buildProgramPayload(
      {
        university_name: 'TU Munich',
        name: 'M.Sc. Mechatronics',
        official_url: 'https://www.tum.de/',
        intake_season: 'winter',
        application_start: '2027-01-01',
        application_end: '2027-05-31',
        ielts_min: 6.5,
      },
      choices,
      TODAY,
    );
    expect(payload).toMatchObject({
      name: 'M.Sc. Mechatronics',
      slug: 'tu-munich-mechatronics-msc',
      university_id: 'u1',
      field_id: 'f1',
      state: 'published',
      ielts_min: 6.5,
      intakes: [
        {
          season: 'winter',
          academic_year: '2027/28',
          application_start: '2027-01-01',
          application_end: '2027-05-31',
        },
      ],
    });
  });

  it('sends only proposed fields for an update and merges intakes', () => {
    const current = {
      intakes: [
        {
          season: 'winter' as const,
          academic_year: '2027/28',
          application_start: null,
          application_end: '2027-05-31',
        },
      ],
    };
    const payload = buildProgramPayload(
      { intake_season: 'summer', application_end: '2027-01-15', tuition_fee_eur: 0 },
      choices,
      TODAY,
      current,
    );
    expect(payload).not.toHaveProperty('slug');
    expect(payload).not.toHaveProperty('state');
    expect(payload.tuition_fee_eur).toBe(0);
    expect(payload.intakes).toHaveLength(2);
  });

  it('leaves intakes untouched when no dates were proposed', () => {
    const payload = buildProgramPayload({ intake_season: 'summer' }, choices, TODAY, {
      intakes: [],
    });
    expect(payload).not.toHaveProperty('intakes');
  });
});
