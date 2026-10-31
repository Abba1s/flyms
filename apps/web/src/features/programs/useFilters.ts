import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_FILTERS, parseFilters, serializeFilters, type Filters } from './filters';

/**
 * Filter state lives in the URL so views are shareable and the back button works.
 * `defaults` differ per page (the map defaults to "Open now").
 */
export function useFilters(defaults: Filters = DEFAULT_FILTERS) {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params, defaults), [params, defaults]);

  const update = useCallback(
    (patch: Partial<Filters>, { replace = false } = {}) => {
      const next = { ...filters, ...patch };
      // Any change other than paging returns to page 1.
      if (!('page' in patch)) next.page = 1;
      setParams(serializeFilters(next, defaults), { replace });
    },
    [filters, defaults, setParams],
  );

  const reset = useCallback(
    () => setParams(serializeFilters({ ...defaults, q: filters.q }, defaults)),
    [defaults, filters.q, setParams],
  );

  return { filters, update, reset };
}

/** Build a link that carries the current filters to another view (e.g. list ↔ map). */
export function filtersToSearch(filters: Filters, defaults: Filters = DEFAULT_FILTERS): string {
  const qs = serializeFilters({ ...filters, page: 1 }, defaults).toString();
  return qs ? `?${qs}` : '';
}
