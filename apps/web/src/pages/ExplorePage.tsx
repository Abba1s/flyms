import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FilterIcon, GridIcon, MapIcon, SearchIcon, TableIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pagination } from '@/components/ui/Pagination';
import { useFieldMap, useFields, useSpecializations } from '@/features/programs/api';
import { FilterControls, StatusChips } from '@/features/programs/FilterControls';
import {
  countActiveFilters,
  MAP_DEFAULTS,
  PAGE_SIZES,
  type SortKey,
} from '@/features/programs/filters';
import { ProgramCard } from '@/features/programs/ProgramCard';
import { ProgramTable } from '@/features/programs/ProgramTable';
import { filtersToSearch, useFilters } from '@/features/programs/useFilters';
import { useFilteredPrograms } from '@/features/programs/useFilteredPrograms';
import { DataState } from '@/features/programs/DataState';
import { cn } from '@/lib/cn';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'deadline', label: 'Next deadline' },
  { value: 'qs', label: 'QS ranking' },
  { value: 'tuition', label: 'Tuition' },
  { value: 'name', label: 'Name' },
];

export function ExplorePage() {
  const { filters, update, reset } = useFilters();
  const { results, counts, programs, isPending, isError, refetch } = useFilteredPrograms(filters);
  const { data: fields = [] } = useFields();
  const { data: specializations = [] } = useSpecializations();
  const fieldMap = useFieldMap();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [q, setQ] = useState(filters.q);

  // Debounced search into the URL (replace, so typing does not flood history).
  useEffect(() => setQ(filters.q), [filters.q]);
  useEffect(() => {
    if (q === filters.q) return;
    const t = window.setTimeout(() => update({ q }, { replace: true }), 250);
    return () => window.clearTimeout(t);
  }, [q, filters.q, update]);

  const active = countActiveFilters(filters);
  const pageCount = Math.max(1, Math.ceil(results.length / filters.size));
  const page = Math.min(filters.page, pageCount);
  const pageItems = results.slice((page - 1) * filters.size, page * filters.size);

  const controls = (
    <FilterControls
      filters={filters}
      update={update}
      fields={fields}
      specializations={specializations}
      programs={programs}
    />
  );

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Explore programs</h1>
          <p className="mt-1 text-muted" aria-live="polite">
            {isPending
              ? 'Loading programs…'
              : `${results.length} program${results.length === 1 ? '' : 's'} · ${counts.open} open now`}
          </p>
        </div>
        <Link
          to={`/map${filtersToSearch(filters, MAP_DEFAULTS)}`}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-4 text-sm font-semibold hover:bg-surface-2"
        >
          <MapIcon className="h-4 w-4" />
          View on map
        </Link>
      </header>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by program, university, city or specialization"
          aria-label="Search programs"
          className="h-12 w-full rounded-lg border border-border bg-surface pl-10 pr-4 text-base placeholder:text-muted focus:border-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusChips
          value={filters.status}
          onChange={(status) => update({ status })}
          counts={counts}
        />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" className="lg:hidden" onClick={() => setSheetOpen(true)}>
            <FilterIcon className="h-4 w-4" />
            Filters{active > 0 && ` (${active})`}
          </Button>
          <label className="sr-only" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            value={`${filters.sort}:${filters.dir}`}
            onChange={(e) => {
              const [sort, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
              update({ sort, dir });
            }}
            className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
          >
            {SORT_OPTIONS.flatMap((o) => [
              <option key={`${o.value}:asc`} value={`${o.value}:asc`}>
                {o.label} ↑
              </option>,
              <option key={`${o.value}:desc`} value={`${o.value}:desc`}>
                {o.label} ↓
              </option>,
            ])}
          </select>
          <div
            className="hidden rounded-md border border-border bg-surface p-0.5 lg:flex"
            role="group"
            aria-label="Layout"
          >
            {(['cards', 'table'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                aria-label={v === 'cards' ? 'Card view' : 'Table view'}
                onClick={() => setView(v)}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-[8px]',
                  view === v ? 'bg-primary/12 text-primary' : 'text-muted hover:text-text',
                )}
              >
                {v === 'cards' ? (
                  <GridIcon className="h-4 w-4" />
                ) : (
                  <TableIcon className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Filters</h2>
              {active > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
            {controls}
          </div>
        </aside>

        <section aria-label="Results" className="flex min-w-0 flex-col gap-5">
          <DataState isPending={isPending} isError={isError} onRetry={() => void refetch()}>
            {results.length === 0 ? (
              <EmptyState
                title="No programs match"
                action={
                  <Button variant="secondary" onClick={reset}>
                    Reset filters
                  </Button>
                }
              >
                {filters.status === 'open' && counts.opening > 0
                  ? `${counts.opening} program${counts.opening === 1 ? '' : 's'} open within 60 days.`
                  : 'Try removing a filter or searching for something broader.'}
              </EmptyState>
            ) : view === 'table' ? (
              <ProgramTable programs={pageItems} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pageItems.map((p) => (
                  <ProgramCard
                    key={p.id}
                    program={p}
                    fieldColor={fieldMap.get(p.field_slug)?.color}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Pagination page={page} pageCount={pageCount} onChange={(p) => update({ page: p })} />
              <label className="flex items-center gap-2 text-sm text-muted">
                Per page
                <select
                  value={filters.size}
                  onChange={(e) => update({ size: Number(e.target.value) })}
                  className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </DataState>
        </section>
      </div>

      <Dialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Filters"
        variant="sheet"
        footer={
          <>
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
            <Button onClick={() => setSheetOpen(false)}>Show {results.length} programs</Button>
          </>
        }
      >
        {controls}
      </Dialog>
    </div>
  );
}
