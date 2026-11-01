import { daysBetween, getIntakeStatus, getProgramStatus } from '@flyms/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExternalIcon, FlagIcon } from '@/components/icons';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge, UnverifiedBadge } from '@/components/ui/StatusBadge';
import { trackProgramView, useFieldMap, useProgramDetail } from '@/features/programs/api';
import {
  LANGUAGE_LABEL,
  PORTAL_LABEL,
  STALE_AFTER_DAYS,
  intakeLabel,
  yesNo,
} from '@/features/programs/labels';
import { SaveButton } from '@/features/programs/SaveButton';
import { ReportDialog } from '@/features/submit/ReportDialog';
import { downloadIcs, eventsFor } from '@/features/calendar/ics';
import { CompareToggle } from '@/features/compare/CompareToggle';
import { ReviewsSection } from '@/features/reviews/ReviewsSection';
import { formatDate, formatEuro } from '@/lib/format';
import { useToday } from '@/lib/useToday';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
          <dd className="text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgramPage() {
  const { slug = '' } = useParams();
  const { data: p, isPending, isError } = useProgramDetail(slug);
  const today = useToday();
  const fieldMap = useFieldMap();
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (p) {
      trackProgramView(p.id);
      document.title = `${p.name} · ${p.university_name} — Universal Travel and Education Consultancy`;
    }
    return () => {
      document.title = 'Universal Travel and Education Consultancy';
    };
  }, [p]);

  if (isPending)
    return <div className="mx-auto h-96 max-w-4xl animate-pulse rounded-lg bg-surface" />;
  if (isError || !p) {
    return (
      <div className="mx-auto max-w-xl">
        <EmptyState
          title="Program not found"
          action={
            <Link to="/explore" className="font-semibold text-primary hover:underline">
              Browse all programs
            </Link>
          }
        >
          It may have been removed or renamed.
        </EmptyState>
      </div>
    );
  }

  const status = getProgramStatus(p.intakes, today);
  const stale = !p.last_verified_at || daysBetween(p.last_verified_at, today) > STALE_AFTER_DAYS;
  const field = fieldMap.get(p.field_slug);

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-5">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link to="/explore" className="hover:text-text hover:underline">
          Explore
        </Link>{' '}
        /{' '}
        <Link to={`/universities/${p.university_slug}`} className="hover:text-text hover:underline">
          {p.university_name}
        </Link>
      </nav>

      <header
        className="flex flex-col gap-4 rounded-lg border border-border border-l-4 bg-surface p-5"
        style={{ borderLeftColor: field?.color }}
      >
        <div className="flex flex-wrap items-center gap-2 self-start">
          <StatusBadge status={status} />
          {p.intakes[status.intakeIndex]?.verified === false && status.status !== 'unknown' && (
            <UnverifiedBadge />
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{p.name}</h1>
          <p className="mt-1 text-muted">
            <Link
              to={`/universities/${p.university_slug}`}
              className="font-medium text-text hover:underline"
            >
              {p.university_name}
            </Link>{' '}
            · {p.city}
            {p.german_state !== p.city && `, ${p.german_state}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge>{p.field_name}</Badge>
          <Badge>{p.degree_type}</Badge>
          <Badge>{LANGUAGE_LABEL[p.teaching_language] ?? p.teaching_language}-taught</Badge>
          {p.specializations.map((s) => (
            <Badge key={s.slug}>{s.name}</Badge>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <SaveButton programId={p.id} programName={p.name} variant="full" />
          <a
            href={p.application_url ?? p.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-contrast hover:bg-primary/90"
          >
            Apply
            <ExternalIcon className="h-4 w-4" />
            <span className="sr-only">(opens official site in a new tab)</span>
          </a>
          <Link
            to={`/sop/new?program=${p.id}`}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-surface-2"
          >
            Write SOP
          </Link>
          <a
            href={p.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-surface-2"
          >
            Official page
            <ExternalIcon className="h-4 w-4" />
          </a>
        </div>
        {p.summary && <p className="text-base">{p.summary}</p>}
      </header>

      {stale && (
        <p role="note" className="rounded-md bg-st-closing/12 px-4 py-3 text-sm text-st-closing">
          {p.last_verified_at
            ? `Dates were last verified on ${formatDate(p.last_verified_at)} and may be outdated.`
            : 'These details have not been verified yet.'}{' '}
          Check the official page before applying.
        </p>
      )}

      <Section title="Application windows">
        {p.intakes.length === 0 ? (
          <p className="text-sm text-muted">No application dates published yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {p.intakes.map((i) => (
              <li
                key={`${i.season}-${i.year}`}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{intakeLabel(i)}</p>
                  <p className="text-sm tabular-nums text-muted">
                    {i.start ? formatDate(i.start) : 'Start not stated'} –{' '}
                    {i.end ? formatDate(i.end) : 'deadline not stated'}
                    {i.eu_end && ` · EU applicants: ${formatDate(i.eu_end)}`}
                  </p>
                  {i.note && <p className="text-sm text-muted">{i.note}</p>}
                  {i.verified && i.verified_source === 'daad' && i.verified_at && (
                    <p className="text-xs text-muted">
                      Deadline confirmed with DAAD on {formatDate(i.verified_at.slice(0, 10))}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 self-start sm:justify-end sm:self-center">
                  <StatusBadge status={getIntakeStatus(i, today)} size="sm" />
                  {i.verified === false && i.end && <UnverifiedBadge />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Requirements">
        <Facts
          items={[
            ['IELTS (minimum)', p.ielts_min?.toFixed(1) ?? p.english_note ?? 'Not stated'],
            ...(p.ielts_min !== null && p.english_note
              ? [['English note', p.english_note] as [string, ReactNode]]
              : []),
            ['MOI accepted', yesNo(p.moi_accepted)],
            ['VPD required', yesNo(p.vpd_required)],
            ['NC (restricted admission)', yesNo(p.nc_restricted)],
            ['German level', p.german_level ?? 'Not stated'],
            ['GRE / GMAT', p.gre_gmat ?? 'Not stated'],
            ['Entrance test / interview', p.entrance_exam_interview ?? 'Not stated'],
            ['Portfolio', p.portfolio_required ? 'Required' : 'Not required'],
            ...(p.work_experience_years !== null
              ? [['Work experience', `${p.work_experience_years} years`] as [string, ReactNode]]
              : []),
            ...(p.min_gpa_note ? [['Grades', p.min_gpa_note] as [string, ReactNode]] : []),
          ]}
        />
      </Section>

      <Section title="Costs & application">
        <Facts
          items={[
            ['Tuition per semester', formatEuro(p.tuition_fee_eur)],
            ...(p.tuition_note ? [['Tuition note', p.tuition_note] as [string, ReactNode]] : []),
            ['Semester contribution', formatEuro(p.semester_contribution_eur)],
            [
              'Application fee',
              p.application_fee_eur === 0 ? 'None' : formatEuro(p.application_fee_eur),
            ],
            ['Apply via', p.application_portal ? PORTAL_LABEL[p.application_portal] : 'Not stated'],
            ...(p.duration_semesters
              ? [['Duration', `${p.duration_semesters} semesters`] as [string, ReactNode]]
              : []),
            ...(p.ects ? [['Credits', `${p.ects} ECTS`] as [string, ReactNode]] : []),
          ]}
        />
      </Section>

      {p.highlights.length > 0 && (
        <Section title="Highlights">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {p.highlights.map((h) => (
              <li key={h.text}>{h.text}</li>
            ))}
          </ul>
        </Section>
      )}

      <ReviewsSection
        programId={p.id}
        programName={p.name}
        avg={p.review_avg}
        count={p.review_count}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={() =>
            downloadIcs(
              eventsFor([p]).filter((e) => e.date >= today),
              `${p.slug}.ics`,
            )
          }
          className="font-semibold text-primary hover:underline"
        >
          Add dates to calendar
        </button>
        <Link to={`/costs?program=${p.id}`} className="font-semibold text-primary hover:underline">
          Estimate costs
        </Link>
        <CompareToggle programId={p.id} className="text-sm" />
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
        >
          <FlagIcon className="h-4 w-4" />
          Report wrong info
        </button>
        <Link
          to={`/contribute?program=${p.id}`}
          className="font-semibold text-primary hover:underline"
        >
          Suggest an update
        </Link>
      </div>
      <ReportDialog
        programId={p.id}
        programName={p.name}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      <footer className="text-xs text-muted">
        Source:{' '}
        {p.source_url ? (
          <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="underline">
            official program page
          </a>
        ) : (
          'official program page'
        )}
        {p.last_verified_at && ` · verified ${formatDate(p.last_verified_at)}`}
      </footer>
    </article>
  );
}
