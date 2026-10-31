import { programSlug, type ProgramProposal } from '@flyms/shared';

export interface IntakeRow {
  season: 'winter' | 'summer';
  academic_year: string;
  application_start: string | null;
  application_end: string | null;
  eu_end?: string | null;
  note?: string | null;
}

/** Academic year label for an intake, inferred from its deadline (winter → "2027/28", summer → "2027"). */
export function academicYear(
  season: 'winter' | 'summer',
  end: string | undefined,
  today: string,
): string {
  const ref = end ?? today;
  const year = Number(ref.slice(0, 4));
  const month = Number(ref.slice(5, 7));
  if (season === 'winter') {
    const y = month > 9 ? year + 1 : year;
    return `${y}/${String(y + 1).slice(2)}`;
  }
  return String(month >= 7 ? year + 1 : year);
}

/** Replace the intake of the same season and year; keep the others. */
export function mergeIntake(current: IntakeRow[], next: IntakeRow): IntakeRow[] {
  const rest = current.filter(
    (i) => !(i.season === next.season && i.academic_year === next.academic_year),
  );
  return [...rest, next];
}

export interface ApprovalChoices {
  university_id: string;
  university_slug: string;
  field_id: string;
  degree_type: string;
  teaching_language: string;
  publish: boolean;
}

const DIRECT_FIELDS = [
  'official_url',
  'application_url',
  'ielts_min',
  'tuition_fee_eur',
  'application_fee_eur',
  'moi_accepted',
  'vpd_required',
] as const;

/**
 * Turn a contributor's proposal into an `admin_upsert_program` payload.
 * New programs get every proposed field; updates only send what was proposed, and intake
 * dates are merged into the program's existing intakes rather than replacing them.
 */
export function buildProgramPayload(
  proposal: Partial<ProgramProposal>,
  choices: ApprovalChoices,
  today: string,
  current?: { intakes: IntakeRow[] },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of DIRECT_FIELDS) if (proposal[key] !== undefined) payload[key] = proposal[key];

  if (!current) {
    const name = proposal.name ?? '';
    Object.assign(payload, {
      name,
      slug: programSlug(choices.university_slug, name, choices.degree_type),
      university_id: choices.university_id,
      field_id: choices.field_id,
      degree_type: choices.degree_type,
      teaching_language: choices.teaching_language,
      state: choices.publish ? 'published' : 'draft',
      source_url: proposal.official_url,
    });
  } else {
    if (proposal.name) payload.name = proposal.name;
    if (proposal.degree_type) payload.degree_type = proposal.degree_type;
    if (proposal.teaching_language) payload.teaching_language = proposal.teaching_language;
  }

  const hasDates = proposal.application_start || proposal.application_end;
  if (proposal.intake_season && hasDates) {
    const intake: IntakeRow = {
      season: proposal.intake_season,
      academic_year: academicYear(proposal.intake_season, proposal.application_end, today),
      application_start: proposal.application_start ?? null,
      application_end: proposal.application_end ?? null,
    };
    payload.intakes = mergeIntake(current?.intakes ?? [], intake);
  }
  return payload;
}
