import { daysBetween } from '@flyms/shared';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { useAdminPrograms } from '@/features/admin/api';
import { STALE_AFTER_DAYS } from '@/features/programs/labels';
import { formatDate } from '@/lib/format';
import { useToday } from '@/lib/useToday';

export function ProgramsAdminPage() {
  const { data: programs = [], isPending } = useAdminPrograms();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const today = useToday();
  const state = params.get('state') ?? 'all';
  const staleOnly = params.get('stale') === '1';
  const showDeleted = params.get('deleted') === '1';

  const isStale = (d: string | null) => !d || daysBetween(d, today) > STALE_AFTER_DAYS;
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return programs.filter(
      (p) =>
        (showDeleted ? p.deleted_at !== null : p.deleted_at === null) &&
        (state === 'all' || p.state === state) &&
        (!staleOnly || isStale(p.last_verified_at)) &&
        (!needle ||
          `${p.name} ${p.universities?.name ?? ''} ${p.slug}`.toLowerCase().includes(needle)),
    );
    // isStale depends only on today
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs, q, state, staleOnly, showDeleted, today]);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Programs</h1>
        <Link
          to="/admin/programs/new"
          className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-contrast"
        >
          New program
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, university, slug"
          aria-label="Search programs"
          className="h-10 w-72 rounded-md border border-border bg-surface px-3 text-sm"
        />
        <select
          aria-label="State"
          value={state}
          onChange={(e) => setParam('state', e.target.value === 'all' ? null : e.target.value)}
          className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        >
          <option value="all">All states</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => setParam('stale', e.target.checked ? '1' : null)}
          />
          Unverified / stale only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDeleted}
            onChange={(e) => setParam('deleted', e.target.checked ? '1' : null)}
          />
          Show deleted
        </label>
        <span className="text-sm text-muted">{rows.length} shown</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Program</th>
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Verified</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {isPending && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-muted">
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-surface-2/60">
                <td className="px-3 py-2">
                  <Link
                    to={`/admin/programs/${p.id}`}
                    className="font-semibold hover:text-primary hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="text-xs text-muted">{p.universities?.name}</div>
                </td>
                <td className="px-3 py-2">{p.fields?.name}</td>
                <td className="px-3 py-2">
                  <Badge className={p.state === 'published' ? 'bg-st-open/12 text-st-open' : ''}>
                    {p.state}
                  </Badge>
                </td>
                <td
                  className={`px-3 py-2 tabular-nums ${isStale(p.last_verified_at) ? 'text-st-closing' : ''}`}
                >
                  {p.last_verified_at ? formatDate(p.last_verified_at) : 'Never'}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted">
                  {formatDate(p.updated_at.slice(0, 10))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
