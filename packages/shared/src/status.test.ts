import { describe, expect, it } from 'vitest';
import vectors from './status-vectors.json';
import {
  type AdmissionStatus,
  berlinToday,
  daysBetween,
  getIntakeStatus,
  getProgramStatus,
  isOpen,
  mostUrgentStatus,
} from './status';

describe('getIntakeStatus vectors (shared with SQL)', () => {
  for (const v of vectors) {
    it(v.name, () => {
      expect(getIntakeStatus({ start: v.start, end: v.end }, v.today).status).toBe(v.status);
    });
  }
});

describe('getIntakeStatus details', () => {
  it('reports days left while open', () => {
    const s = getIntakeStatus({ start: '2026-10-01', end: '2027-01-15' }, '2027-01-10');
    expect(s).toMatchObject({ status: 'closing_soon', daysLeft: 5, startStated: true });
  });

  it('reports days until opening', () => {
    const s = getIntakeStatus({ start: '2026-12-01', end: '2027-01-15' }, '2026-11-01');
    expect(s).toMatchObject({ status: 'opening_soon', daysUntilOpen: 30, daysLeft: null });
  });

  it('flags open intakes with no start date', () => {
    const s = getIntakeStatus({ start: null, end: '2027-01-15' }, '2026-11-01');
    expect(s).toMatchObject({ status: 'open', startStated: false });
  });

  it('rejects malformed dates', () => {
    expect(() => getIntakeStatus({ start: null, end: '15.01.2027' }, '2026-11-01')).toThrow();
  });
});

describe('getProgramStatus', () => {
  const winter = { start: '2027-02-01', end: '2027-05-31' };
  const summer = { start: '2026-10-01', end: '2026-11-10' };

  it('picks the most urgent intake', () => {
    const s = getProgramStatus([winter, summer], '2026-11-01');
    expect(s).toMatchObject({ status: 'closing_soon', intakeIndex: 1, daysLeft: 9 });
  });

  it('breaks ties by the soonest date', () => {
    const later = { start: '2026-10-01', end: '2027-03-01' };
    const sooner = { start: '2026-10-01', end: '2027-02-01' };
    expect(getProgramStatus([later, sooner], '2026-11-01').intakeIndex).toBe(1);
  });

  it('is unknown with no intakes', () => {
    expect(getProgramStatus([], '2026-11-01')).toMatchObject({
      status: 'unknown',
      intakeIndex: -1,
    });
  });
});

describe('helpers', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2027-03-28', '2027-03-27')).toBe(-1);
  });

  it('uses the Berlin calendar date', () => {
    // 23:30 UTC on 31 Dec is already 1 Jan in Berlin (UTC+1).
    expect(berlinToday(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    // 21:59 UTC in summer is 23:59 in Berlin (UTC+2).
    expect(berlinToday(new Date('2027-07-15T21:59:00Z'))).toBe('2027-07-15');
  });

  it('ranks urgency', () => {
    const all: AdmissionStatus[] = ['closed', 'opening_soon', 'open', 'unknown'];
    expect(mostUrgentStatus(all)).toBe('open');
    expect(mostUrgentStatus([...all, 'closing_soon'])).toBe('closing_soon');
    expect(mostUrgentStatus([])).toBe('unknown');
    expect(isOpen('closing_soon')).toBe(true);
    expect(isOpen('opening_soon')).toBe(false);
  });
});
