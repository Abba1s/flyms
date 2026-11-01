import type { AdmissionStatus, IntakeStatus } from '@flyms/shared';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** `2027-01-15` → `15 Jan 2027` (never an ambiguous numeric format). */
export function formatDate(iso: string, { withYear = true } = {}): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return (withYear ? dateFormatter : shortDateFormatter).format(date);
}

export function formatEuro(amount: number | null): string {
  if (amount === null) return 'Not stated';
  if (amount === 0) return 'No tuition';
  return `€${amount.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
}

/** Category names (legends, exports, map). Badges use `statusLabel`, which is more specific. */
export const STATUS_LABEL: Record<AdmissionStatus, string> = {
  closing_soon: 'Closing soon',
  open: 'Applications open',
  opening_soon: 'Upcoming intake',
  closed: 'Applications closed',
  unknown: 'Dates not published',
};

/** True when applications are closed now but a future start date is known. */
export function isUpcoming(s: IntakeStatus): boolean {
  return s.status === 'opening_soon' || (s.status === 'closed' && s.daysUntilOpen !== null);
}

/** Badge label: "Closing in 3 days", "Applications open", "Upcoming intake", … */
export function statusLabel(s: IntakeStatus): string {
  if (s.status === 'closing_soon' && s.daysLeft !== null) {
    if (s.daysLeft === 0) return 'Closes today';
    if (s.daysLeft === 1) return 'Closes tomorrow';
    return `Closing in ${s.daysLeft} days`;
  }
  if (isUpcoming(s)) return 'Upcoming intake';
  return STATUS_LABEL[s.status];
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** Short countdown text, e.g. "Closes today", "6 days left", "Opens tomorrow". */
export function countdownText(s: IntakeStatus): string | null {
  // The closing-soon label already carries the countdown.
  if (s.status === 'closing_soon') return null;
  if (s.daysLeft !== null) {
    if (s.daysLeft === 0) return 'Closes today';
    if (s.daysLeft === 1) return 'Closes tomorrow';
    return `${plural(s.daysLeft, 'day')} left`;
  }
  if (s.daysUntilOpen !== null) {
    if (s.daysUntilOpen === 1) return 'Opens tomorrow';
    return `Opens in ${plural(s.daysUntilOpen, 'day')}`;
  }
  return null;
}
