import { useMemo } from 'react';
import { usePrograms } from './api';
import {
  applyNonStatusFilters,
  buildSearchIndex,
  matchesStatus,
  sortPrograms,
  STATUS_FILTERS,
  type Filters,
  type StatusFilter,
} from './filters';

/** Programs after filters, plus per-status counts of the same set (for chips and summaries). */
export function useFilteredPrograms(filters: Filters) {
  const query = usePrograms(filters.asOf);
  const { programs } = query;
  const index = useMemo(() => buildSearchIndex(programs), [programs]);

  const base = useMemo(
    () => applyNonStatusFilters(programs, filters, index),
    [programs, filters, index],
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(STATUS_FILTERS.map((f) => [f, 0])) as Record<StatusFilter, number>;
    for (const p of base) for (const f of STATUS_FILTERS) if (matchesStatus(p.status, f)) c[f]++;
    return c;
  }, [base]);

  const results = useMemo(
    () =>
      sortPrograms(
        base.filter((p) => matchesStatus(p.status, filters.status)),
        filters.sort,
        filters.dir,
      ),
    [base, filters.status, filters.sort, filters.dir],
  );

  return { ...query, results, counts };
}
