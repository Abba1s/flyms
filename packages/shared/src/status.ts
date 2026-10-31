/**
 * Admission status engine.
 *
 * All dates are calendar dates (`YYYY-MM-DD`) interpreted in Europe/Berlin.
 * Deadlines are inclusive: a program closing on 2027-01-15 is open until
 * 23:59:59 Berlin time that day. The SQL function `admission_status` in
 * supabase/migrations mirrors these rules; `status-vectors.json` keeps both in sync.
 */

export const CLOSING_SOON_DAYS = 14;
export const OPENING_SOON_DAYS = 60;
export const ADMISSION_TIME_ZONE = 'Europe/Berlin';

export type AdmissionStatus = 'closing_soon' | 'open' | 'opening_soon' | 'closed' | 'unknown';

/** Higher number = more urgent. Used to pick a program's or a pin's headline status. */
export const STATUS_URGENCY: Record<AdmissionStatus, number> = {
  closing_soon: 4,
  open: 3,
  opening_soon: 2,
  closed: 1,
  unknown: 0,
};

export interface IntakeDates {
  start: string | null;
  end: string | null;
}

export interface IntakeStatus {
  status: AdmissionStatus;
  /** Days until the deadline (0 = closes today). Set while open. */
  daysLeft: number | null;
  /** Days until applications open. Set when the start date is in the future. */
  daysUntilOpen: number | null;
  /** False when an open intake has no published start date. */
  startStated: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toUtcDay(isoDate: string): number {
  if (!ISO_DATE.test(isoDate)) throw new Error(`Invalid ISO date: ${isoDate}`);
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return toUtcDay(to) - toUtcDay(from);
}

const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ADMISSION_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in Berlin as `YYYY-MM-DD`. */
export function berlinToday(now: Date = new Date()): string {
  return berlinFormatter.format(now);
}

export function getIntakeStatus(intake: IntakeDates, today: string): IntakeStatus {
  const { start, end } = intake;
  const base = { daysLeft: null, daysUntilOpen: null, startStated: start !== null };

  if (end === null) {
    const daysUntilOpen =
      start !== null && daysBetween(today, start) > 0 ? daysBetween(today, start) : null;
    return { ...base, status: 'unknown', daysUntilOpen };
  }

  const daysLeft = daysBetween(today, end);
  const started = start === null || daysBetween(start, today) >= 0;

  if (started && daysLeft >= 0) {
    return {
      ...base,
      status: daysLeft <= CLOSING_SOON_DAYS ? 'closing_soon' : 'open',
      daysLeft,
    };
  }

  if (!started && start !== null) {
    const daysUntilOpen = daysBetween(today, start);
    return {
      ...base,
      status: daysUntilOpen <= OPENING_SOON_DAYS ? 'opening_soon' : 'closed',
      daysUntilOpen,
    };
  }

  return { ...base, status: 'closed' };
}

export interface ProgramStatus extends IntakeStatus {
  /** Index into the intakes array of the intake that determined the status, or -1 if none. */
  intakeIndex: number;
}

/** Sort key among intakes with the same status: the soonest relevant date wins. */
function tieBreakDays(s: IntakeStatus): number {
  if (s.daysLeft !== null) return s.daysLeft;
  if (s.daysUntilOpen !== null) return s.daysUntilOpen;
  return Number.POSITIVE_INFINITY;
}

export function getProgramStatus(intakes: readonly IntakeDates[], today: string): ProgramStatus {
  let best: ProgramStatus = {
    status: 'unknown',
    daysLeft: null,
    daysUntilOpen: null,
    startStated: false,
    intakeIndex: -1,
  };
  intakes.forEach((intake, intakeIndex) => {
    const s = getIntakeStatus(intake, today);
    const moreUrgent = STATUS_URGENCY[s.status] > STATUS_URGENCY[best.status];
    const sameButSooner =
      STATUS_URGENCY[s.status] === STATUS_URGENCY[best.status] &&
      tieBreakDays(s) < tieBreakDays(best);
    if (best.intakeIndex === -1 || moreUrgent || sameButSooner) best = { ...s, intakeIndex };
  });
  return best;
}

/** The most urgent of several statuses (e.g. all programs at one university pin). */
export function mostUrgentStatus(statuses: Iterable<AdmissionStatus>): AdmissionStatus {
  let best: AdmissionStatus = 'unknown';
  for (const s of statuses) if (STATUS_URGENCY[s] > STATUS_URGENCY[best]) best = s;
  return best;
}

/** True for statuses that count as "open now" in summaries and pin badges. */
export function isOpen(status: AdmissionStatus): boolean {
  return status === 'open' || status === 'closing_soon';
}
