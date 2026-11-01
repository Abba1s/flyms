import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge, UnverifiedBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/format';
import type { ProgramWithStatus } from './api';
import { LANGUAGE_LABEL, intakeLabel } from './labels';
import { CompareToggle } from '@/features/compare/CompareToggle';
import { SaveButton } from './SaveButton';

interface ProgramCardProps {
  program: ProgramWithStatus;
  fieldColor?: string;
}

/** The deadline or opening date that the status refers to. */
/** Only worth saying when there is a deadline to doubt. */
export function showUnverified(p: ProgramWithStatus): boolean {
  return !p.deadlineVerified && p.status.status !== 'unknown';
}

export function keyDateText(p: ProgramWithStatus): string | null {
  const intake = p.intakes[p.status.intakeIndex];
  if (!intake) return null;
  if (p.status.daysLeft !== null && intake.end) return `Deadline ${formatDate(intake.end)}`;
  if (p.status.daysUntilOpen !== null && intake.start) return `Opens ${formatDate(intake.start)}`;
  if (intake.end) return `Closed ${formatDate(intake.end)}`;
  return null;
}

export function RequirementChips({ program: p }: { program: ProgramWithStatus }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge>{p.degree_type}</Badge>
      <Badge>{LANGUAGE_LABEL[p.teaching_language]}</Badge>
      {p.intakes[0] && <Badge>{intakeLabel(p.intakes[0])}</Badge>}
      {p.ielts_min !== null && <Badge>IELTS {p.ielts_min.toFixed(1)}</Badge>}
      {p.moi_accepted === true && <Badge>MOI accepted</Badge>}
      {p.vpd_required === true && <Badge>VPD required</Badge>}
      {p.nc_restricted === true && <Badge>NC</Badge>}
      {p.tuition_fee_eur === 0 && <Badge>No tuition</Badge>}
    </div>
  );
}

export function ProgramCard({ program: p, fieldColor }: ProgramCardProps) {
  const keyDate = keyDateText(p);
  return (
    <article
      className="group relative flex flex-col gap-3 rounded-lg border border-border border-l-4 bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
      style={{ borderLeftColor: fieldColor }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={p.status} size="sm" />
          {showUnverified(p) && <UnverifiedBadge />}
        </div>
        <SaveButton programId={p.id} programName={p.name} className="-mr-2 -mt-2" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug">
          <Link
            to={`/programs/${p.slug}`}
            className="after:absolute after:inset-0 focus:outline-none"
          >
            {p.name}
          </Link>
        </h3>
        <p className="text-sm text-muted">
          {p.university_name} · {p.city}
        </p>
        {keyDate && <p className="text-sm font-medium tabular-nums">{keyDate}</p>}
      </div>
      <RequirementChips program={p} />
      <CompareToggle programId={p.id} className="mt-auto self-start" />
    </article>
  );
}
