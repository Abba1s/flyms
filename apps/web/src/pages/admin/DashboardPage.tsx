import { Link } from 'react-router-dom';
import { BrokenLinks } from '@/features/admin/BrokenLinks';
import { useFields } from '@/features/programs/api';
import { useAdminStats, useQueueCounts } from '@/features/admin/api';

function Tile({
  label,
  value,
  to,
  tone,
}: {
  label: string;
  value: number;
  to?: string;
  tone?: 'warn';
}) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p
        className={`text-3xl font-bold tabular-nums ${tone === 'warn' && value > 0 ? 'text-st-closing' : ''}`}
      >
        {value}
      </p>
    </>
  );
  const cls = 'flex flex-col gap-1 rounded-lg border border-border bg-surface p-4';
  return to ? (
    <Link to={to} className={`${cls} hover:shadow-md`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function DashboardPage() {
  const { data: stats = [] } = useAdminStats();
  const { data: counts } = useQueueCounts();
  const { data: fields = [] } = useFields();
  const sum = (k: 'published' | 'drafts' | 'open_now' | 'stale') =>
    stats.reduce((n, r) => n + Number(r[k]), 0);
  const fieldName = new Map(fields.map((f) => [f.slug, f.name]));

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Published programs" value={sum('published')} to="/admin/programs" />
        <Tile label="Open now" value={sum('open_now')} />
        <Tile label="Drafts" value={sum('drafts')} to="/admin/programs?state=draft" />
        <Tile
          label="Unverified or stale (> 180 days)"
          value={sum('stale')}
          to="/admin/programs?stale=1"
          tone="warn"
        />
        <Tile
          label="Pending change requests"
          value={counts?.changes ?? 0}
          to="/admin/queue/changes"
          tone="warn"
        />
        <Tile
          label="Open data reports"
          value={counts?.reports ?? 0}
          to="/admin/queue/reports"
          tone="warn"
        />
      </div>

      <section className="rounded-lg border border-border bg-surface">
        <h2 className="border-b border-border px-4 py-3 font-semibold">By field</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-2">Field</th>
              <th className="px-4 py-2 text-right">Published</th>
              <th className="px-4 py-2 text-right">Open now</th>
              <th className="px-4 py-2 text-right">Drafts</th>
              <th className="px-4 py-2 text-right">Stale</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((r) => (
              <tr key={r.field_slug} className="border-t border-border">
                <td className="px-4 py-2">{fieldName.get(r.field_slug) ?? r.field_slug}</td>
                <td
                  className={`px-4 py-2 text-right tabular-nums ${Number(r.published) < 10 ? 'text-st-closing' : ''}`}
                >
                  {r.published}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{r.open_now}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.drafts}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.stale}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-2 text-xs text-muted">
          Fields with fewer than 10 published programs are highlighted (launch target).
        </p>
      </section>

      <BrokenLinks />
    </div>
  );
}
