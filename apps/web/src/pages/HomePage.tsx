import { isOpen } from '@flyms/shared';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronIcon, MapIcon, SearchIcon } from '@/components/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { usePrograms, useFields } from '@/features/programs/api';
import { sortPrograms } from '@/features/programs/filters';

export function HomePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const { programs, isPending } = usePrograms();
  const { data: fields = [] } = useFields();

  const byField = useMemo(() => {
    const m = new Map<string, { total: number; open: number }>();
    for (const p of programs) {
      const c = m.get(p.field_slug) ?? { total: 0, open: 0 };
      c.total++;
      if (isOpen(p.status.status)) c.open++;
      m.set(p.field_slug, c);
    }
    return m;
  }, [programs]);

  const openNow = programs.filter((p) => isOpen(p.status.status));
  const closingSoon = sortPrograms(
    programs.filter((p) => p.status.status === 'closing_soon'),
    'deadline',
    'asc',
  ).slice(0, 5);
  const universitiesOpen = new Set(openNow.map((p) => p.university_id)).size;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10">
      <section className="flex flex-col gap-5 pt-2 md:pt-6">
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl md:leading-[1.1]">
          Find a master&apos;s in Germany you can apply to{' '}
          <span className="text-primary">today</span>.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Every field, every intake. See where admissions are open right now, save programs, and
          keep track of deadlines.
        </p>
        <form
          role="search"
          className="flex max-w-2xl flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            navigate(q.trim() ? `/explore?q=${encodeURIComponent(q.trim())}` : '/explore');
          }}
        >
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Data Science, Mechatronics, Berlin"
              aria-label="Search programs"
              className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-base placeholder:text-muted focus:border-primary focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-12 rounded-lg bg-primary px-6 font-semibold text-primary-contrast hover:bg-primary/90"
          >
            Search
          </button>
        </form>
        {!isPending && (
          <Link
            to="/map"
            className="inline-flex items-center gap-2 self-start rounded-full bg-st-open/12 px-4 py-2 text-sm font-semibold text-st-open hover:bg-st-open/20"
          >
            <MapIcon className="h-4 w-4" />
            {openNow.length} programs open now at {universitiesOpen} universities
            <ChevronIcon className="h-4 w-4" />
          </Link>
        )}
      </section>

      <section aria-labelledby="fields-heading" className="flex flex-col gap-4">
        <h2 id="fields-heading" className="text-xl font-semibold">
          Browse by field
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fields.map((f) => {
            const c = byField.get(f.slug);
            return (
              <Link
                key={f.slug}
                to={c?.open ? `/map?field=${f.slug}` : `/explore?field=${f.slug}`}
                className="flex items-center gap-3 rounded-lg border border-border border-l-4 bg-surface p-4 shadow-sm transition-shadow hover:shadow-md"
                style={{ borderLeftColor: f.color }}
              >
                <div className="flex-1">
                  <p className="font-semibold">{f.name}</p>
                  <p className="text-sm text-muted">
                    {c ? (
                      <>
                        <span className="font-semibold text-st-open">{c.open} open now</span> ·{' '}
                        {c.total} program{c.total === 1 ? '' : 's'}
                      </>
                    ) : (
                      'Programs coming soon'
                    )}
                  </p>
                </div>
                <ChevronIcon className="h-5 w-5 text-muted" />
              </Link>
            );
          })}
        </div>
      </section>

      {closingSoon.length > 0 && (
        <section aria-labelledby="closing-heading" className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <h2 id="closing-heading" className="text-xl font-semibold">
              Closing in the next 15 days
            </h2>
            <Link
              to="/explore?status=closing"
              className="text-sm font-semibold text-primary hover:underline"
            >
              See all
            </Link>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {closingSoon.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/programs/${p.slug}`}
                  className="flex flex-col gap-1 px-4 py-3 hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name}</p>
                    <p className="truncate text-sm text-muted">
                      {p.university_name} · {p.city}
                    </p>
                  </div>
                  <StatusBadge status={p.status} size="sm" className="self-start sm:self-center" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted">
        Deadlines change every year. Always confirm dates and requirements on the official program
        page before applying.
      </p>
    </div>
  );
}
