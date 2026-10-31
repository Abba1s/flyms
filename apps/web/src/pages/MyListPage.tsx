import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloseIcon, DownloadIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { downloadCsv, downloadXlsx, exportRows } from '@/features/mylist/export';
import { useFieldMap, usePrograms } from '@/features/programs/api';
import { DataState } from '@/features/programs/DataState';
import { sortPrograms } from '@/features/programs/filters';
import { TrackerBoard } from '@/features/mylist/TrackerBoard';
import { TRACKER_LABEL, TrackerDialog } from '@/features/mylist/TrackerDialog';
import type { ProgramWithStatus } from '@/features/programs/api';
import { ProgramCard } from '@/features/programs/ProgramCard';
import { cn } from '@/lib/cn';
import { track } from '@/lib/analytics';
import { useLocalStore } from '@/stores/local';

const BANNER = 'local-storage-notice';

export function MyListPage() {
  const saved = useLocalStore((s) => s.saved);
  const dismissed = useLocalStore((s) => s.dismissedBanners.includes(BANNER));
  const dismissBanner = useLocalStore((s) => s.dismissBanner);
  const { programs, isPending, isError, refetch } = usePrograms();
  const fieldMap = useFieldMap();
  const toast = useToast();
  const [exporting, setExporting] = useState<'csv' | 'xlsx' | null>(null);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [open, setOpen] = useState<ProgramWithStatus | null>(null);
  const tracker = useLocalStore((s) => s.tracker);

  const savedAt = useMemo(() => new Map(saved.map((s) => [s.id, s.savedAt])), [saved]);
  const list = useMemo(
    () =>
      sortPrograms(
        programs.filter((p) => savedAt.has(p.id)),
        'deadline',
        'asc',
      ),
    [programs, savedAt],
  );
  // Saved programs that were unpublished or removed since.
  const missing = isPending ? 0 : saved.length - list.length;

  const runExport = async (kind: 'csv' | 'xlsx') => {
    setExporting(kind);
    try {
      const rows = exportRows(list, savedAt);
      await (kind === 'csv' ? downloadCsv(rows) : downloadXlsx(rows));
      track('List Export', { format: kind });
      toast(`Exported ${list.length} program${list.length === 1 ? '' : 's'}`);
    } catch {
      toast('Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">My List</h1>
          <p className="mt-1 text-muted">
            {saved.length} saved program{saved.length === 1 ? '' : 's'}, sorted by next deadline.
          </p>
        </div>
        {list.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <div
              className="flex rounded-md border border-border bg-surface p-0.5"
              role="group"
              aria-label="View"
            >
              {(['list', 'board'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={cn(
                    'h-9 rounded-[8px] px-3 text-sm font-semibold',
                    view === v ? 'bg-primary/12 text-primary' : 'text-muted hover:text-text',
                  )}
                >
                  {v === 'list' ? 'List' : 'Tracker board'}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() => void runExport('xlsx')}
              disabled={exporting !== null}
            >
              <DownloadIcon className="h-4 w-4" />
              {exporting === 'xlsx' ? 'Exporting…' : 'Excel'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void runExport('csv')}
              disabled={exporting !== null}
            >
              <DownloadIcon className="h-4 w-4" />
              {exporting === 'csv' ? 'Exporting…' : 'CSV'}
            </Button>
          </div>
        )}
      </header>

      {!dismissed && (
        <div
          role="note"
          className="flex items-start gap-3 rounded-md bg-primary/12 px-4 py-3 text-sm"
        >
          <p className="flex-1">
            Your list is saved only on this device. Make a backup from{' '}
            <Link to="/settings" className="font-semibold text-primary underline">
              Settings
            </Link>{' '}
            to move it to another browser.
          </p>
          <button
            type="button"
            onClick={() => dismissBanner(BANNER)}
            aria-label="Dismiss"
            className="grid h-6 w-6 place-items-center rounded text-muted hover:text-text"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <DataState isPending={isPending} isError={isError} onRetry={() => void refetch()}>
        {list.length === 0 ? (
          <EmptyState
            title="No saved programs yet"
            action={
              <Link
                to="/map"
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-contrast"
              >
                Find open programs
              </Link>
            }
          >
            Tap the bookmark on any program to keep it here with its deadline.
          </EmptyState>
        ) : view === 'board' ? (
          <TrackerBoard programs={list} onOpen={setOpen} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((p) => (
              <div key={p.id} className="flex flex-col gap-1.5">
                <ProgramCard program={p} fieldColor={fieldMap.get(p.field_slug)?.color} />
                <button
                  type="button"
                  onClick={() => setOpen(p)}
                  className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-2"
                >
                  <span>
                    <span className="text-muted">Status: </span>
                    <span className="font-semibold">
                      {TRACKER_LABEL[tracker[p.id]?.status ?? 'researching']}
                    </span>
                  </span>
                  <span className="font-semibold text-primary">Track</span>
                </button>
              </div>
            ))}
          </div>
        )}
        {missing > 0 && (
          <p className="text-sm text-muted">
            {missing} saved program{missing === 1 ? ' is' : 's are'} no longer listed and{' '}
            {missing === 1 ? 'is' : 'are'} hidden.
          </p>
        )}
      </DataState>
      <TrackerDialog program={open} onClose={() => setOpen(null)} />
    </div>
  );
}
