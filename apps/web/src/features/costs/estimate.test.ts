import { estimateCost } from './estimate';

describe('estimateCost', () => {
  it('adds up a 4-semester program', () => {
    const e = estimateCost({
      semesters: 4,
      tuitionPerSemester: 1500,
      contributionPerSemester: 300,
      livingMonthly: 900,
      insuranceMonthly: 140,
      oneTime: 500,
    });
    expect(e.months).toBe(24);
    expect(e.tuitionTotal).toBe(6000);
    expect(e.contributionTotal).toBe(1200);
    expect(e.livingTotal).toBe(21600);
    expect(e.insuranceTotal).toBe(3360);
    expect(e.total).toBe(6000 + 1200 + 21600 + 3360 + 500);
    expect(e.perSemester).toBe((6000 + 1200 + 21600 + 3360) / 4);
    expect(e.blockedAccount).toBe(992 * 12);
    expect(e.monthlyGap).toBe(900 + 140 - 992);
  });

  it('treats invalid or negative inputs as zero and keeps at least one semester', () => {
    const e = estimateCost({
      semesters: 0,
      tuitionPerSemester: -5,
      contributionPerSemester: Number.NaN,
      livingMonthly: 800,
      insuranceMonthly: 0,
      oneTime: -1,
    });
    expect(e.months).toBe(6);
    expect(e.tuitionTotal).toBe(0);
    expect(e.contributionTotal).toBe(0);
    expect(e.total).toBe(4800);
    expect(e.monthlyGap).toBe(0);
  });
});
