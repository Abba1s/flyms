// Generated from packages/shared/src by scripts/sync_function_shared.py — do not edit.
/**
 * Deadline sync rules — pure functions shared by the `deadline-sync` Edge Function and tests.
 *
 * A source (DAAD) gives one deadline per course. We compare it with a program's intakes and
 * decide what to do. Only unambiguous cases change data; everything else is flagged for review.
 */

export type ParsedDeadline =
  | { kind: 'date'; date: string; moreDeadlines: number }
  | { kind: 'none' }
  | { kind: 'unparsed'; text: string };

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** `15 January 2027` → `2027-01-15`, or null if it is not a real calendar date. */
export function parseLongDate(day: string, month: string, year: string): string | null {
  const m = MONTHS[month.toLowerCase()];
  const d = Number(day);
  const y = Number(year);
  if (!m || !Number.isInteger(d) || !Number.isInteger(y)) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** Remove HTML tags and entities so free text can be stored and shown to an admin. */
export function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;|&mdash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const REGISTER_BY = /^Register by (\d{1,2}) ([A-Za-z]+) (\d{4})(?: \+ (\d+) more)?$/;

/**
 * Read DAAD's `applicationDeadline` field. Only the structured form
 * ("Register by 15 January 2027 + 1 more") is trusted; free text needs a human.
 */
export function parseDaadDeadline(raw: string | null | undefined): ParsedDeadline {
  const text = plainText(raw ?? '');
  if (!text || /no deadline/i.test(text)) return { kind: 'none' };
  const m = REGISTER_BY.exec(text);
  if (m) {
    const date = parseLongDate(m[1]!, m[2]!, m[3]!);
    if (date) return { kind: 'date', date, moreDeadlines: m[4] ? Number(m[4]) : 0 };
  }
  return { kind: 'unparsed', text };
}

export interface SyncIntake {
  id: string;
  start: string | null;
  end: string | null;
}

/** A source deadline this many days from an intake's stored deadline is treated as the same deadline, moved. */
export const SAME_DEADLINE_WINDOW_DAYS = 60;

export type Reconciliation =
  | { action: 'verify'; intakeId: string }
  | { action: 'update'; intakeId: string; oldEnd: string; newEnd: string }
  | { action: 'flag'; intakeId: string | null; reason: string };

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export interface ReconcileContext {
  /** Today in Berlin (`YYYY-MM-DD`). */
  today: string;
  /** How many further deadlines the source has that we cannot see ("+ 2 more"). */
  moreDeadlines: number;
}

/**
 * Decide what one source deadline means for a program's intakes.
 * - Same date as a stored deadline → that intake is verified.
 * - The source date has passed → flag; a stale listing says nothing about the next cycle.
 * - Exactly one stored deadline within the window, and the source lists no other deadlines
 *   → the deadline moved; update it.
 * - Otherwise (none, several, hidden extra deadlines, or before applications open) → flag.
 */
export function reconcileDeadline(
  intakes: readonly SyncIntake[],
  sourceEnd: string,
  { today, moreDeadlines }: ReconcileContext,
): Reconciliation {
  const exact = intakes.find((i) => i.end === sourceEnd);
  if (exact) return { action: 'verify', intakeId: exact.id };

  if (sourceEnd < today) {
    return {
      action: 'flag',
      intakeId: null,
      reason: `Source lists a deadline that has already passed (${sourceEnd}); its listing may be out of date`,
    };
  }

  const near = intakes.filter(
    (i) =>
      i.end !== null &&
      Math.abs(dayNumber(i.end) - dayNumber(sourceEnd)) <= SAME_DEADLINE_WINDOW_DAYS,
  );
  if (near.length === 1) {
    const intake = near[0]!;
    if (intake.start !== null && intake.start > sourceEnd) {
      return {
        action: 'flag',
        intakeId: intake.id,
        reason: `Source deadline ${sourceEnd} is before the stored application start ${intake.start}`,
      };
    }
    if (moreDeadlines > 0) {
      return {
        action: 'flag',
        intakeId: intake.id,
        reason: `Source shows ${sourceEnd} (stored ${intake.end}) and has ${moreDeadlines} more deadline${moreDeadlines === 1 ? '' : 's'} not shown, so it may be for a different applicant group`,
      };
    }
    return { action: 'update', intakeId: intake.id, oldEnd: intake.end!, newEnd: sourceEnd };
  }
  if (near.length > 1) {
    return {
      action: 'flag',
      intakeId: null,
      reason: `Source deadline ${sourceEnd} is close to more than one stored intake`,
    };
  }
  return {
    action: 'flag',
    intakeId: null,
    reason: `Source deadline ${sourceEnd} does not match any stored intake (new cycle?)`,
  };
}

/** Lowercase, strip accents and punctuation, and drop degree prefixes like "M.Sc.". */
export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(
      /\b(m\.?\s?sc|m\.?\s?a|m\.?\s?eng|m\.?\s?ba|ll\.?\s?m|m\.?\s?ed|m\.?\s?fa|m\.?\s?res|master of (science|arts|engineering)|master)\b\.?/g,
      ' ',
    )
    .replace(/\((msc|ma|meng|mba|llm|med|mfa|mres)\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// ─── Matching programs to source courses ────────────────────────────────────

export interface SourceCourse {
  id: string;
  name: string;
  institution: string;
  city: string;
}

export interface MatchTarget {
  name: string;
  university: string;
  city: string;
}

const words = (s: string) =>
  new Set(
    normalizeName(s)
      .split(' ')
      .filter((t) => t.length > 2),
  );

/** Same city, or most of the institution's name words shared. */
export function sameInstitution(course: SourceCourse, target: MatchTarget): boolean {
  if (normalizeName(course.city) === normalizeName(target.city)) return true;
  const a = words(course.institution);
  const b = words(target.university);
  const shared = [...a].filter((t) => b.has(t)).length;
  return shared >= 2 && shared / Math.min(a.size, b.size) >= 0.6;
}

export function indexCoursesByName(courses: Iterable<SourceCourse>): Map<string, SourceCourse[]> {
  const index = new Map<string, SourceCourse[]>();
  for (const c of courses) {
    const key = normalizeName(c.name);
    index.set(key, [...(index.get(key) ?? []), c]);
  }
  return index;
}

/** The one course with the same name at the same institution, or null if none or ambiguous. */
export function findCourseMatch(
  target: MatchTarget,
  byName: Map<string, SourceCourse[]>,
): SourceCourse | null {
  const matches = (byName.get(normalizeName(target.name)) ?? []).filter((c) =>
    sameInstitution(c, target),
  );
  return matches.length === 1 ? matches[0]! : null;
}

// ─── Closing-soon buckets shown on the site ─────────────────────────────────

export const CLOSING_BUCKETS = [3, 7, 15] as const;
export type ClosingBucket = (typeof CLOSING_BUCKETS)[number];

/** The smallest bucket a deadline falls in (3, 7 or 15 days), or null if further away. */
export function closingBucket(daysLeft: number | null): ClosingBucket | null {
  if (daysLeft === null || daysLeft < 0) return null;
  return CLOSING_BUCKETS.find((b) => daysLeft <= b) ?? null;
}
