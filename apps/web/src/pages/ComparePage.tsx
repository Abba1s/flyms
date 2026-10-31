import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CloseIcon } from '@/components/icons';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePrograms, type ProgramWithStatus } from '@/features/programs/api';
import { DataState } from '@/features/programs/DataState';
import { keyDateText } from '@/features/programs/ProgramCard';
import { LANGUAGE_LABEL, PORTAL_LABEL, intakeLabel, yesNo } from '@/features/programs/labels';
import { SaveButton } from '@/features/programs/SaveButton';
import { formatEuro } from '@/lib/format';
import { useLocalStore } from '@/stores/local';

const ROWS: [string, (p: ProgramWithStatus) => ReactNode][] = [
  ['Status', (p) => <StatusBadge status={p.status} size="sm" />],
  ['Key date', (p) => keyDateText(p) ?? '—'],
  ['Intakes', (p) => p.intakes.map(intakeLabel).join(', ') || '—'],
  ['University', (p) => `${p.university_name}, ${p.city}`],
  ['QS ranking', (p) => p.qs_ranking ?? '—'],
  ['Degree', (p) => p.degree_type],
  ['Teaching language', (p) => LANGUAGE_LABEL[p.teaching_language]],
  ['IELTS minimum', (p) => p.ielts_min?.toFixed(1) ?? 'Not stated'],
  ['MOI accepted', (p) => yesNo(p.moi_accepted)],
  ['German level', (p) => p.german_level ?? 'Not stated'],
  ['VPD required', (p) => yesNo(p.vpd_required)],
  ['NC (restricted)', (p) => yesNo(p.nc_restricted)],
  ['GRE / GMAT', (p) => p.gre_gmat ?? 'Not stated'],
  ['Portfolio', (p) => (p.portfolio_required ? 'Required' : 'No')],
  ['Tuition / semester', (p) => formatEuro(p.tuition_fee_eur)],
  [
    'Application fee',
    (p) => (p.application_fee_eur === 0 ? 'None' : formatEuro(p.application_fee_eur)),
  ],
  ['Apply via', (p) => (p.application_portal ? PORTAL_LABEL[p.application_portal] : 'Not stated')],
];

export function ComparePage() {
  const ids = useLocalStore((s) => s.compareIds);
  const toggle = useLocalStore((s) => s.toggleCompare);
  const { programs, isPending, isError, refetch } = usePrograms();
  const selected = ids
    .map((id) => programs.find((p) => p.id === id))
    .filter((p): p is ProgramWithStatus => Boolean(p));

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Compare programs</h1>
        <p className="mt-1 text-muted">
          Tick “Compare” on up to 4 programs to see them side by side.
        </p>
      </header>
      <DataState isPending={isPending} isError={isError} onRetry={() => void refetch()}>
        {selected.length === 0 ? (
          <EmptyState
            title="Nothing to compare yet"
            action={
              <Link to="/explore" className="font-semibold text-primary hover:underline">
                Browse programs
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[640px] table-fixed text-sm">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="w-40 bg-surface-2 p-3 text-left text-xs uppercase text-muted"
                  >
                    <span className="sr-only">Attribute</span>
                  </th>
                  {selected.map((p) => (
                    <th
                      key={p.id}
                      scope="col"
                      className="border-l border-border p-3 text-left align-top"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/programs/${p.slug}`}
                          className="font-semibold leading-snug hover:underline"
                        >
                          {p.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggle(p.id)}
                          aria-label={`Remove ${p.name} from comparison`}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2"
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      </div>
                      <SaveButton
                        programId={p.id}
                        programName={p.name}
                        variant="full"
                        className="mt-2 h-8 px-3"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, render]) => (
                  <tr key={label} className="border-t border-border">
                    <th
                      scope="row"
                      className="bg-surface-2 p-3 text-left text-xs font-semibold uppercase text-muted"
                    >
                      {label}
                    </th>
                    {selected.map((p) => (
                      <td key={p.id} className="border-l border-border p-3 align-top">
                        {render(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DataState>
    </div>
  );
}
