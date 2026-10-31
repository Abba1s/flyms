import { isOpen } from '@flyms/shared';
import { useMemo } from 'react';
import { usePrograms } from './api';
import {
  applyNonStatusFilters,
  buildSearchIndex,
  matchesStatus,
  sortPrograms,
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
    const c: Record<StatusFilter, number> = { open: 0, closing: 0, opening: 0, all: base.length };
    for (const p of base) {
      if (isOpen(p.status.status)) c.open++;
      if (p.status.status === 'closing_soon') c.closing++;
      if (p.status.status === 'opening_soon') c.opening++;
    }
    return c;
  }, [base]);

  const results = useMemo(
    () =>
      sortPrograms(
        base.filter((p) => matchesStatus(p.status.status, filters.status)),
        filters.sort,
        filters.dir,
      ),
    [base, filters.status, filters.sort, filters.dir],
  );

  return { ...query, results, counts };
}
