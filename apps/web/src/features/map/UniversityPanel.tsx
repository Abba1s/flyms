import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronIcon, CloseIcon, ExternalIcon } from '@/components/icons';
import { StatusBadge, StatusIcon } from '@/components/ui/StatusBadge';
import { keyDateText } from '@/features/programs/ProgramCard';
import { PORTAL_LABEL, intakeLabel } from '@/features/programs/labels';
import { SaveButton } from '@/features/programs/SaveButton';
import { ReportDialog } from '@/features/submit/ReportDialog';
import { STATUS_LABEL, formatDate } from '@/lib/format';
import { groupProgramsByStatus, type UniversityPin } from './aggregate';

const MAX_PER_GROUP = 5;

/** Details for one university: its matching programs grouped by status, with actions. */
export function UniversityPanel({
  pin,
  onClose,
  showName = true,
}: {
  pin: UniversityPin;
  onClose?: () => void;
  /** False inside a sheet whose title already shows the university name. */
  showName?: boolean;
}) {
  const groups = groupProgramsByStatus(pin.programs);
  const [reportFor, setReportFor] = useState<{ id: string; name: string } | null>(null);
  const verified = pin.programs
    .map((p) => p.last_verified_at)
    .filter((d): d is string => d !== null)
    .sort()[0];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {showName && (
            <h2 className="font-display text-lg font-semibold leading-tight">
              <Link to={`/universities/${pin.slug}`} className="hover:underline">
                {pin.name}
              </Link>
            </h2>
          )}
          <p className="text-sm text-muted">
            {pin.city}
            {pin.qsRanking && ` · QS ${pin.qsRanking}`}
            {!showName && (
              <>
                {' · '}
                <Link
                  to={`/universities/${pin.slug}`}
                  className="font-semibold text-primary hover:underline"
                >
                  All programs
                </Link>
              </>
            )}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close university details"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {groups.map((g) => (
        <section key={g.status} aria-label={STATUS_LABEL[g.status]} className="flex flex-col gap-2">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <StatusIcon status={g.status} />
            {STATUS_LABEL[g.status]} · {g.programs.length}
          </h3>
          <ul className="flex flex-col gap-2">
            {g.programs.slice(0, MAX_PER_GROUP).map((p) => {
              const intake = p.intakes[p.status.intakeIndex];
              return (
                <li key={p.id} className="rounded-md border border-border bg-bg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/programs/${p.slug}`}
                        className="font-semibold leading-snug hover:underline"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {intake && intakeLabel(intake)}
                        {p.application_portal && ` · ${PORTAL_LABEL[p.application_portal]}`}
                      </p>
                    </div>
                    <SaveButton programId={p.id} programName={p.name} className="-mr-2 -mt-2" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={p.status} size="sm" />
                    {keyDateText(p) && (
                      <span className="text-xs tabular-nums text-muted">{keyDateText(p)}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    {[
                      p.ielts_min !== null ? `IELTS ${p.ielts_min.toFixed(1)}` : null,
                      p.moi_accepted === true ? 'MOI ✓' : p.moi_accepted === false ? 'MOI ✗' : null,
                      p.vpd_required === true ? 'VPD' : null,
                      p.teaching_language === 'german' ? 'German-taught' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Requirements: see details'}
                  </p>
                  <div className="mt-2 flex gap-3 text-sm font-semibold">
                    <Link
                      to={`/programs/${p.slug}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Details <ChevronIcon className="h-3.5 w-3.5" />
                    </Link>
                    <a
                      href={p.application_url ?? p.official_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Apply <ExternalIcon className="h-3.5 w-3.5" />
                      <span className="sr-only">(opens official site)</span>
                    </a>
                    <Link
                      to={`/sop/new?program=${p.id}`}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Write SOP
                    </Link>
                    <button
                      type="button"
                      onClick={() => setReportFor({ id: p.id, name: p.name })}
                      className="ml-auto text-xs font-medium text-muted hover:text-text hover:underline"
                    >
                      Report
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          {g.programs.length > MAX_PER_GROUP && (
            <Link
              to={`/universities/${pin.slug}`}
              className="text-sm font-semibold text-primary hover:underline"
            >
              +{g.programs.length - MAX_PER_GROUP} more
            </Link>
          )}
        </section>
      ))}

      <p className="text-xs text-muted">
        {verified ? `Dates last verified ${formatDate(verified)}.` : 'Dates not verified yet.'}{' '}
        Always check the official page before applying.
      </p>
      <ReportDialog
        programId={reportFor?.id ?? ''}
        programName={reportFor?.name ?? ''}
        open={reportFor !== null}
        onOpenChange={(o) => !o && setReportFor(null)}
      />
    </div>
  );
}

/** Compact list of universities, most urgent first — the map's accessible equivalent. */
export function UniversityList({
  pins,
  onSelect,
}: {
  pins: UniversityPin[];
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col divide-y divide-border">
      {pins.map((pin) => {
        const top = pin.programs[0];
        return (
          <li key={pin.id}>
            <button
              type="button"
              onClick={() => onSelect(pin.id)}
              className="flex w-full items-start gap-3 px-1 py-3 text-left hover:bg-surface-2"
            >
              <StatusIcon status={pin.status} className={`mt-1 ${STATUS_TEXT[pin.status]}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{pin.name}</span>
                <span className="block text-sm text-muted">
                  {pin.city} · {pin.programs.length} program{pin.programs.length === 1 ? '' : 's'}
                  {pin.openCount > 0 && ` · ${pin.openCount} open`}
                </span>
                {top && <StatusBadge status={top.status} size="sm" className="mt-1" />}
              </span>
              <ChevronIcon className="mt-1 h-4 w-4 text-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const STATUS_TEXT: Record<UniversityPin['status'], string> = {
  closing_soon: 'text-st-closing',
  open: 'text-st-open',
  opening_soon: 'text-st-opening',
  closed: 'text-st-closed',
  unknown: 'text-st-unknown',
};
