import { describe, expect, it } from 'vitest';
import {
  closingBucket,
  findCourseMatch,
  indexCoursesByName,
  normalizeName,
  parseDaadDeadline,
  reconcileDeadline,
} from './deadlines';

describe('parseDaadDeadline', () => {
  it('reads the structured "Register by" form', () => {
    expect(parseDaadDeadline('Register by 15 January 2027')).toEqual({
      kind: 'date',
      date: '2027-01-15',
      moreDeadlines: 0,
    });
    expect(parseDaadDeadline('Register by 1 September 2026 + 3 more')).toEqual({
      kind: 'date',
      date: '2026-09-01',
      moreDeadlines: 3,
    });
  });

  it('recognises "no deadline"', () => {
    expect(parseDaadDeadline('This programme has no deadline.')).toEqual({ kind: 'none' });
    expect(parseDaadDeadline(null)).toEqual({ kind: 'none' });
  });

  it('leaves free text and impossible dates for a human', () => {
    const r = parseDaadDeadline(
      '<p>The application deadline is 15&nbsp;July; late applications may be accepted.</p>',
    );
    expect(r).toEqual({
      kind: 'unparsed',
      text: 'The application deadline is 15 July; late applications may be accepted.',
    });
    expect(parseDaadDeadline('Register by 31 February 2027').kind).toBe('unparsed');
    expect(parseDaadDeadline('Register by 15 Janvier 2027').kind).toBe('unparsed');
  });
});

describe('reconcileDeadline', () => {
  const ctx = { today: '2026-11-01', moreDeadlines: 0 };
  const intakes = [
    { id: 'summer', start: '2026-10-01', end: '2027-01-15' },
    { id: 'winter', start: '2027-04-01', end: '2027-05-31' },
  ];

  it('verifies an exact match', () => {
    expect(reconcileDeadline(intakes, '2027-01-15', ctx)).toEqual({
      action: 'verify',
      intakeId: 'summer',
    });
  });

  it('updates a deadline that moved a little', () => {
    expect(reconcileDeadline(intakes, '2027-01-31', ctx)).toEqual({
      action: 'update',
      intakeId: 'summer',
      oldEnd: '2027-01-15',
      newEnd: '2027-01-31',
    });
  });

  it('flags a date close to two intakes', () => {
    const twoClose = [
      { id: 'eu', start: null, end: '2027-03-01' },
      { id: 'non-eu', start: null, end: '2027-04-15' },
    ];
    const r = reconcileDeadline(twoClose, '2027-03-20', ctx);
    expect(r.action).toBe('flag');
    expect(r).toMatchObject({ intakeId: null });
  });

  it('flags a date matching no intake', () => {
    expect(reconcileDeadline(intakes, '2027-09-30', ctx)).toMatchObject({
      action: 'flag',
      intakeId: null,
    });
    expect(reconcileDeadline([], '2027-01-15', ctx)).toMatchObject({
      action: 'flag',
      intakeId: null,
    });
  });

  it('flags a new deadline that falls before applications open', () => {
    expect(reconcileDeadline(intakes, '2027-03-20', ctx)).toMatchObject({ action: 'flag' });
    const r = reconcileDeadline(
      [{ id: 'w', start: '2027-04-01', end: '2027-05-15' }],
      '2027-03-25',
      ctx,
    );
    expect(r).toMatchObject({ action: 'flag', intakeId: 'w' });
  });
});

describe('reconcileDeadline safeguards', () => {
  const intakes = [{ id: 'summer', start: '2026-10-01', end: '2027-01-15' }];

  it('verifies an exact match even when it has passed or more deadlines exist', () => {
    expect(
      reconcileDeadline(intakes, '2027-01-15', { today: '2027-02-01', moreDeadlines: 2 }),
    ).toEqual({
      action: 'verify',
      intakeId: 'summer',
    });
  });

  it('never applies a past date', () => {
    expect(
      reconcileDeadline(intakes, '2026-12-20', { today: '2027-01-02', moreDeadlines: 0 }),
    ).toMatchObject({ action: 'flag', intakeId: null });
  });

  it('flags instead of updating when the source has hidden extra deadlines', () => {
    expect(
      reconcileDeadline(intakes, '2027-01-31', { today: '2026-11-01', moreDeadlines: 1 }),
    ).toMatchObject({ action: 'flag', intakeId: 'summer' });
  });
});

describe('course matching', () => {
  const index = indexCoursesByName([
    { id: '1', name: 'Computer Science', institution: 'University of Bonn', city: 'Bonn' },
    {
      id: '2',
      name: 'Computer Science',
      institution: 'University of Stuttgart',
      city: 'Stuttgart',
    },
    { id: '3', name: 'Data Science', institution: 'Marburg University', city: 'Marburg' },
    { id: '4', name: 'Data Science', institution: 'Philipps-Universität Marburg', city: 'Marburg' },
  ]);

  it('matches the same name at the same university', () => {
    expect(
      findCourseMatch(
        {
          name: 'M.Sc. Computer Science',
          university: 'University of Stuttgart',
          city: 'Stuttgart',
        },
        index,
      )?.id,
    ).toBe('2');
  });

  it('refuses ambiguous or missing matches', () => {
    expect(
      findCourseMatch(
        { name: 'M.Sc. Data Science', university: 'University of Marburg', city: 'Marburg' },
        index,
      ),
    ).toBeNull();
    expect(
      findCourseMatch(
        { name: 'M.Sc. Physics', university: 'University of Bonn', city: 'Bonn' },
        index,
      ),
    ).toBeNull();
  });
});

describe('normalizeName', () => {
  it('ignores degree prefixes, accents and punctuation', () => {
    expect(normalizeName('M.Sc. Human-Computer Interaction')).toBe('human computer interaction');
    expect(normalizeName('Human Computer Interaction (MSc)')).toBe('human computer interaction');
    expect(normalizeName('Master of Science in Data Science')).toBe('in data science');
    expect(normalizeName('Technische Universität München')).toBe('technische universitat munchen');
  });
});

describe('closingBucket', () => {
  it('puts days left into the 3 / 7 / 15 buckets', () => {
    expect(closingBucket(0)).toBe(3);
    expect(closingBucket(3)).toBe(3);
    expect(closingBucket(4)).toBe(7);
    expect(closingBucket(7)).toBe(7);
    expect(closingBucket(15)).toBe(15);
    expect(closingBucket(16)).toBeNull();
    expect(closingBucket(null)).toBeNull();
  });
});
