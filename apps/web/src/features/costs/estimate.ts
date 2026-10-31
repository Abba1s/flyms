/**
 * Study-cost estimate. Defaults are rough reference values with a stated year — every input
 * is editable, and the UI tells visitors to check current official figures.
 */
export const COST_DEFAULTS = {
  /** Blocked-account monthly amount required for the student visa (figure in force from 2025). */
  blockedAccountMonthly: 992,
  blockedAccountYear: 2025,
  /** Typical public student health insurance per month (approximate, 2025). */
  insuranceMonthly: 140,
  /** National (D) visa fee. */
  visaFee: 75,
  semesterContribution: 300,
  semesters: 4,
} as const;

export interface CostInputs {
  semesters: number;
  tuitionPerSemester: number;
  contributionPerSemester: number;
  /** Rent + food + transport + other living costs per month, excluding insurance. */
  livingMonthly: number;
  insuranceMonthly: number;
  oneTime: number;
}

export interface CostEstimate {
  months: number;
  perSemester: number;
  tuitionTotal: number;
  contributionTotal: number;
  livingTotal: number;
  insuranceTotal: number;
  oneTime: number;
  total: number;
  /** Proof of funds for the visa: 12 × the blocked-account monthly amount. */
  blockedAccount: number;
  /** Extra per month the visitor needs on top of the blocked-account payout. */
  monthlyGap: number;
}

const nonNegative = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function estimateCost(
  input: CostInputs,
  blockedMonthly = COST_DEFAULTS.blockedAccountMonthly,
): CostEstimate {
  const semesters = Math.max(1, Math.round(nonNegative(input.semesters)));
  const months = semesters * 6;
  const tuitionTotal = nonNegative(input.tuitionPerSemester) * semesters;
  const contributionTotal = nonNegative(input.contributionPerSemester) * semesters;
  const livingTotal = nonNegative(input.livingMonthly) * months;
  const insuranceTotal = nonNegative(input.insuranceMonthly) * months;
  const oneTime = nonNegative(input.oneTime);
  const total = tuitionTotal + contributionTotal + livingTotal + insuranceTotal + oneTime;
  const monthlyNeed = nonNegative(input.livingMonthly) + nonNegative(input.insuranceMonthly);
  return {
    months,
    perSemester: Math.round((total - oneTime) / semesters),
    tuitionTotal,
    contributionTotal,
    livingTotal,
    insuranceTotal,
    oneTime,
    total: Math.round(total),
    blockedAccount: blockedMonthly * 12,
    monthlyGap: Math.max(0, Math.round(monthlyNeed - blockedMonthly)),
  };
}
