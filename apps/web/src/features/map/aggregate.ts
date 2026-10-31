import { STATUS_URGENCY, isOpen, mostUrgentStatus, type AdmissionStatus } from '@flyms/shared';
import type { ProgramWithStatus } from '@/features/programs/api';
import { sortPrograms } from '@/features/programs/filters';

export interface UniversityPin {
  id: string;
  slug: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  qsRanking: string | null;
  /** Most urgent status among the matching programs — decides pin colour. */
  status: AdmissionStatus;
  openCount: number;
  /** Matching programs, most urgent first, then soonest deadline. */
  programs: ProgramWithStatus[];
}

export function groupByUniversity(programs: ProgramWithStatus[]): UniversityPin[] {
  const groups = new Map<string, ProgramWithStatus[]>();
  for (const p of programs) {
    const list = groups.get(p.university_id);
    if (list) list.push(p);
    else groups.set(p.university_id, [p]);
  }

  const pins: UniversityPin[] = [];
  for (const [id, list] of groups) {
    const first = list[0]!;
    const sorted = sortPrograms(list, 'deadline', 'asc').sort(
      (a, b) => STATUS_URGENCY[b.status.status] - STATUS_URGENCY[a.status.status],
    );
    pins.push({
      id,
      slug: first.university_slug,
      name: first.university_name,
      city: first.city,
      lat: first.lat,
      lng: first.lng,
      qsRanking: first.qs_ranking,
      status: mostUrgentStatus(list.map((p) => p.status.status)),
      openCount: list.filter((p) => isOpen(p.status.status)).length,
      programs: sorted,
    });
  }
  return sortPins(pins);
}

/** Order for the side list: most urgent first, then the soonest deadline. */
function sortPins(pins: UniversityPin[]): UniversityPin[] {
  const soonest = (pin: UniversityPin) => {
    const s = pin.programs[0]?.status;
    return s?.daysLeft ?? (s?.daysUntilOpen ?? Infinity) + 10_000;
  };
  return pins.sort(
    (a, b) =>
      STATUS_URGENCY[b.status] - STATUS_URGENCY[a.status] ||
      soonest(a) - soonest(b) ||
      a.name.localeCompare(b.name),
  );
}

/** Group a university's programs by status for the popup. */
export function groupProgramsByStatus(programs: ProgramWithStatus[]) {
  const order: AdmissionStatus[] = ['closing_soon', 'open', 'opening_soon', 'closed', 'unknown'];
  return order
    .map((status) => ({ status, programs: programs.filter((p) => p.status.status === status) }))
    .filter((g) => g.programs.length > 0);
}
