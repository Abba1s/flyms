import { Link } from 'react-router-dom';
import { StatusBadge, UnverifiedBadge } from '@/components/ui/StatusBadge';
import { showUnverified } from './ProgramCard';
import { formatEuro } from '@/lib/format';
import type { ProgramWithStatus } from './api';
import { keyDateText } from './ProgramCard';
import { LANGUAGE_LABEL, yesNo } from './labels';
import { SaveButton } from './SaveButton';

export function ProgramTable({ programs }: { programs: ProgramWithStatus[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="sticky top-0 bg-surface-2 text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Status
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Program
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Key date
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Language
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              IELTS
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              MOI
            </th>
            <th scope="col" className="px-3 py-2.5 font-semibold">
              Tuition / sem.
            </th>
            <th scope="col" className="px-3 py-2.5">
              <span className="sr-only">Save</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {programs.map((p) => (
            <tr key={p.id} className="border-t border-border hover:bg-surface-2/60">
              <td className="px-3 py-2.5">
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={p.status} size="sm" />
                  {showUnverified(p) && <UnverifiedBadge />}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <Link
                  to={`/programs/${p.slug}`}
                  className="font-semibold hover:text-primary hover:underline"
                >
                  {p.name}
                </Link>
                <div className="text-xs text-muted">
                  {p.university_name} · {p.city}
                </div>
              </td>
              <td className="px-3 py-2.5 tabular-nums">{keyDateText(p) ?? '—'}</td>
              <td className="px-3 py-2.5">{LANGUAGE_LABEL[p.teaching_language]}</td>
              <td className="px-3 py-2.5 tabular-nums">{p.ielts_min?.toFixed(1) ?? '—'}</td>
              <td className="px-3 py-2.5">{yesNo(p.moi_accepted)}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatEuro(p.tuition_fee_eur)}</td>
              <td className="px-1 py-1 text-right">
                <SaveButton programId={p.id} programName={p.name} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
