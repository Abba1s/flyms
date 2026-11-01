import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import '@/features/map/map.css';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { ListIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { StatusIcon } from '@/components/ui/StatusBadge';
import { groupByUniversity } from '@/features/map/aggregate';
import { PinLayer } from '@/features/map/PinLayer';
import { UniversityList, UniversityPanel } from '@/features/map/UniversityPanel';
import { useFields } from '@/features/programs/api';
import { FieldChips, STATUS_OPTIONS, StatusChips } from '@/features/programs/FilterControls';
import { DEFAULT_FILTERS, MAP_DEFAULTS } from '@/features/programs/filters';
import { filtersToSearch, useFilters } from '@/features/programs/useFilters';
import { useFilteredPrograms } from '@/features/programs/useFilteredPrograms';
import { cn } from '@/lib/cn';
import { daysBetween } from '@flyms/shared';
import { formatDate } from '@/lib/format';
import { useIsDark } from '@/lib/theme';
import { useToday } from '@/lib/useToday';

const GERMANY_CENTER: [number, number] = [51.1, 10.4];
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Tile URLs come from env so production can use a keyed provider (e.g. MapTiler, Stadia).
 * Without them we fall back to OpenStreetMap's standard tiles — fine for development and light
 * use under the OSM tile policy — and darken them with a CSS filter in dark mode.
 */
const TILES = {
  light:
    (import.meta.env.VITE_MAP_TILES_LIGHT as string | undefined) ||
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: (import.meta.env.VITE_MAP_TILES_DARK as string | undefined) || undefined,
  attribution:
    (import.meta.env.VITE_MAP_TILES_ATTRIBUTION as string | undefined) || OSM_ATTRIBUTION,
};

function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setDesktop(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return desktop;
}

const LEGEND = [
  ['closing_soon', 'Closing soon (≤ 15 days)'],
  ['open', 'Applications open'],
  ['opening_soon', 'Upcoming intake (opens ≤ 60 days)'],
  ['closed', 'Closed'],
] as const;

const LEGEND_TEXT = {
  closing_soon: 'text-st-closing',
  open: 'text-st-open',
  opening_soon: 'text-st-opening',
  closed: 'text-st-closed',
} as const;

export function MapPage() {
  const { filters, update } = useFilters(MAP_DEFAULTS);
  const { results, counts, isPending, isError, refetch } = useFilteredPrograms(filters);
  const { data: fields = [] } = useFields();
  const dark = useIsDark();
  const desktop = useIsDesktop();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const pins = useMemo(() => groupByUniversity(results), [results]);
  const selected = pins.find((p) => p.id === selectedId) ?? null;

  // Drop a selection that the filters no longer include.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  const realToday = useToday();
  const offset = filters.asOf ? Math.max(0, daysBetween(realToday, filters.asOf)) : 0;
  const setOffset = (days: number) => {
    const d = new Date(`${realToday}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    update({ asOf: days === 0 ? '' : d.toISOString().slice(0, 10) }, { replace: true });
  };
  const when = filters.asOf ? `on ${formatDate(filters.asOf)}` : 'now';
  const statusLabel = STATUS_OPTIONS.find((o) => o.value === filters.status)!
    .label.toLowerCase()
    .replace(' now', ` ${when}`);
  const summary = isPending
    ? 'Loading programs…'
    : filters.status === 'all'
      ? `${results.length} programs at ${pins.length} universities · ${counts.open} open ${when}`
      : `${results.length} program${results.length === 1 ? '' : 's'} ${statusLabel} at ${pins.length} universit${pins.length === 1 ? 'y' : 'ies'}`;

  const select = (id: string) => {
    setSelectedId(id);
    setListOpen(false);
  };

  return (
    <div className="relative flex h-[calc(100dvh-56px-64px)] flex-col md:h-[calc(100dvh-64px)] lg:flex-row">
      <div className="relative min-h-0 flex-1">
        {/* Floating filter bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3">
          <div className="pointer-events-auto flex flex-col gap-2 rounded-lg border border-border bg-surface/95 p-2 shadow-md backdrop-blur">
            <StatusChips
              value={filters.status}
              onChange={(status) => update({ status })}
              counts={counts}
            />
            <FieldChips
              fields={fields}
              selected={filters.fields}
              onChange={(f) => update({ fields: f, specs: [] })}
            />
            <div className="flex items-center gap-3 px-1 text-sm">
              <label htmlFor="as-of" className="shrink-0 font-medium">
                Status on
              </label>
              <input
                id="as-of"
                type="range"
                min={0}
                max={180}
                step={1}
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value))}
                aria-valuetext={filters.asOf ? formatDate(filters.asOf) : 'Today'}
                className="min-w-0 flex-1 accent-[rgb(var(--primary))]"
              />
              <span className="w-24 shrink-0 text-right tabular-nums">
                {filters.asOf ? formatDate(filters.asOf) : 'Today'}
              </span>
              {filters.asOf && (
                <button
                  type="button"
                  onClick={() => setOffset(0)}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <p
            className="pointer-events-auto self-start rounded-full bg-surface/95 px-3 py-1.5 text-sm font-semibold shadow-sm"
            aria-live="polite"
          >
            {summary}
          </p>
        </div>

        <MapContainer
          center={GERMANY_CENTER}
          zoom={6}
          minZoom={5}
          maxZoom={13}
          maxBounds={[
            [45, 2],
            [57.5, 19],
          ]}
          className={cn('fly-map h-full w-full', dark && !TILES.dark && 'fly-map--filter-dark')}
          zoomControl={false}
        >
          <TileLayer
            key={dark && TILES.dark ? 'dark' : 'light'}
            url={dark && TILES.dark ? TILES.dark : TILES.light}
            attribution={TILES.attribution}
          />
          {desktop && <ZoomControl position="bottomright" />}
          <PinLayer pins={pins} selectedId={selectedId} onSelect={select} />
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-10 hidden rounded-lg border border-border bg-surface/95 p-3 text-xs shadow-md sm:block">
          <p className="mb-1.5 font-semibold">Admission status</p>
          <ul className="flex flex-col gap-1">
            {LEGEND.map(([status, label]) => (
              <li key={status} className="flex items-center gap-2">
                <StatusIcon status={status} className={LEGEND_TEXT[status]} />
                {label}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-muted">Badge = programs open now</p>
        </div>

        {/* Mobile: list toggle */}
        <div className="absolute bottom-3 right-3 z-10 lg:hidden">
          <Button onClick={() => setListOpen(true)} className="shadow-md">
            <ListIcon className="h-4 w-4" />
            List ({pins.length})
          </Button>
        </div>

        {isError && (
          <div
            role="alert"
            className="absolute inset-x-3 bottom-16 z-20 flex items-center justify-between gap-3 rounded-lg border border-danger/40 bg-surface p-3 shadow-md"
          >
            <span className="text-sm">We couldn&apos;t load programs.</span>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}
      </div>

      {/* Desktop side panel */}
      <aside
        aria-label={selected ? `${selected.name} programs` : 'Universities'}
        className="hidden w-[380px] shrink-0 flex-col overflow-y-auto border-l border-border bg-surface lg:flex"
      >
        <div className="p-4">
          {selected ? (
            <UniversityPanel pin={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-semibold">
                  {filters.status === 'open' ? 'Open now — closing first' : 'Universities'}
                </h2>
                <Link
                  to={`/explore${filtersToSearch(filters, DEFAULT_FILTERS)}`}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  List view
                </Link>
              </div>
              {pins.length === 0 && !isPending ? (
                <NoResults
                  statusOpen={filters.status === 'open'}
                  opening={counts.opening}
                  onShowOpening={() => update({ status: 'opening' })}
                />
              ) : (
                <UniversityList pins={pins} onSelect={select} />
              )}
            </>
          )}
        </div>
      </aside>

      {/* Mobile sheets */}
      {!desktop && (
        <>
          <Dialog
            open={selected !== null}
            onOpenChange={(o) => !o && setSelectedId(null)}
            title={selected?.name ?? ''}
            variant="sheet"
          >
            {selected && <UniversityPanel pin={selected} showName={false} />}
          </Dialog>
          <Dialog open={listOpen} onOpenChange={setListOpen} title={summary} variant="sheet">
            {pins.length === 0 ? (
              <NoResults
                statusOpen={filters.status === 'open'}
                opening={counts.opening}
                onShowOpening={() => update({ status: 'opening' })}
              />
            ) : (
              <UniversityList pins={pins} onSelect={select} />
            )}
          </Dialog>
        </>
      )}
    </div>
  );
}

function NoResults({
  statusOpen,
  opening,
  onShowOpening,
}: {
  statusOpen: boolean;
  opening: number;
  onShowOpening: () => void;
}) {
  return (
    <div className={cn('flex flex-col items-start gap-3 py-6 text-sm text-muted')}>
      <p>
        {statusOpen
          ? `Nothing is open right now for these filters.${opening > 0 ? ` ${opening} program${opening === 1 ? ' opens' : 's open'} within 60 days.` : ''}`
          : 'No programs match these filters.'}
      </p>
      {statusOpen && opening > 0 && (
        <Button variant="secondary" size="sm" onClick={onShowOpening}>
          Show opening soon
        </Button>
      )}
    </div>
  );
}
