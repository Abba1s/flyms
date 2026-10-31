import { daysBetween, isOpen } from '@flyms/shared';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronIcon, DownloadIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { downloadIcs, eventsFor, type CalendarEvent } from '@/features/calendar/ics';
import { usePrograms } from '@/features/programs/api';
import { DataState } from '@/features/programs/DataState';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { useLocalStore } from '@/stores/local';

type Source = 'saved' | 'open';

const monthFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function EventPill({ e }: { e: CalendarEvent }) {
  return (
    <Link
      to={`/programs/${e.programSlug}`}
      title={`${e.title} — ${e.university}`}
      className={cn(
        'block truncate rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-tight',
        e.kind === 'deadline'
          ? 'bg-st-closing/12 text-st-closing'
          : 'bg-st-opening/12 text-st-opening',
      )}
    >
      {e.kind === 'deadline' ? '⏳ ' : '◷ '}
      {e.title.replace(/^(Deadline|Applications open): /, '')}
    </Link>
  );
}

export function CalendarPage() {
  const { programs, today, isPending, isError, refetch } = usePrograms();
  const saved = useLocalStore((s) => s.saved);
  const [source, setSource] = useState<Source>(saved.length ? 'saved' : 'open');
  const [view, setView] = useState<'agenda' | 'month'>('agenda');
  const [month, setMonth] = useState(today.slice(0, 7));

  const selected = useMemo(() => {
    const ids = new Set(saved.map((s) => s.id));
    return source === 'saved'
      ? programs.filter((p) => ids.has(p.id))
      : programs.filter((p) => isOpen(p.status.status) || p.status.status === 'opening_soon');
  }, [programs, saved, source]);
  const events = useMemo(() => eventsFor(selected), [selected]);
  const upcoming = events.filter((e) => e.date >= today);

  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);

  // Month grid (weeks start on Monday).
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, i) => {
    const day = i - offset + 1;
    return day >= 1 && day <= daysInMonth ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1));
    setMonth(d.toISOString().slice(0, 7));
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Deadlines</h1>
          <p className="mt-1 text-muted">
            {upcoming.length} upcoming date{upcoming.length === 1 ? '' : 's'} in Berlin time.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={upcoming.length === 0}
          onClick={() => downloadIcs(upcoming, `flyms-deadlines-${source}.ics`)}
        >
          <DownloadIcon className="h-4 w-4" />
          Add to calendar (.ics)
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Programs" className="flex gap-2">
          <Chip
            role="radio"
            aria-checked={source === 'saved'}
            aria-pressed={undefined}
            selected={source === 'saved'}
            onClick={() => setSource('saved')}
          >
            My List ({saved.length})
          </Chip>
          <Chip
            role="radio"
            aria-checked={source === 'open'}
            aria-pressed={undefined}
            selected={source === 'open'}
            onClick={() => setSource('open')}
          >
            All open & opening soon
          </Chip>
        </div>
        <div
          className="ml-auto flex rounded-md border border-border bg-surface p-0.5"
          role="group"
          aria-label="View"
        >
          {(['agenda', 'month'] as const).map((v) => (
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
              {v === 'agenda' ? 'Agenda' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <DataState isPending={isPending} isError={isError} onRetry={() => void refetch()}>
        {source === 'saved' && saved.length === 0 ? (
          <EmptyState
            title="No saved programs"
            action={
              <Link to="/map" className="font-semibold text-primary hover:underline">
                Find open programs
              </Link>
            }
          >
            Save programs to see their deadlines here.
          </EmptyState>
        ) : view === 'agenda' ? (
          upcoming.length === 0 ? (
            <EmptyState title="No upcoming dates" />
          ) : (
            <ol className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
              {upcoming.map((e) => {
                const days = daysBetween(today, e.date);
                return (
                  <li
                    key={e.uid}
                    className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="w-36 shrink-0 tabular-nums">
                      <p className="font-semibold">{formatDate(e.date)}</p>
                      <p className="text-xs text-muted">
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <EventPill e={e} />
                      <p className="mt-0.5 truncate text-sm text-muted">{e.university}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )
        ) : (
          <section
            aria-label={monthFormatter.format(first)}
            className="rounded-lg border border-border bg-surface"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
                className="grid h-9 w-9 place-items-center rounded-md hover:bg-surface-2"
              >
                <ChevronIcon dir="left" className="h-4 w-4" />
              </button>
              <h2 className="font-semibold">{monthFormatter.format(first)}</h2>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
                className="grid h-9 w-9 place-items-center rounded-md hover:bg-surface-2"
              >
                <ChevronIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted">
              {WEEKDAYS.map((d) => (
                <div key={d} className="py-2">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 border-t border-border">
              {cells.map((date, i) => {
                const dayEvents = date ? (byDate.get(date) ?? []) : [];
                return (
                  <div
                    key={i}
                    className={cn(
                      'min-h-20 border-b border-r border-border p-1 sm:min-h-24',
                      !date && 'bg-surface-2/40',
                      date === today && 'bg-primary/5',
                    )}
                  >
                    {date && (
                      <>
                        <p
                          className={cn(
                            'mb-1 text-xs tabular-nums',
                            date === today ? 'font-bold text-primary' : 'text-muted',
                          )}
                        >
                          {Number(date.slice(8))}
                        </p>
                        <div className="flex flex-col gap-0.5">
                          {dayEvents.slice(0, 3).map((e) => (
                            <EventPill key={e.uid} e={e} />
                          ))}
                          {dayEvents.length > 3 && (
                            <p className="text-[11px] text-muted">+{dayEvents.length - 3} more</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </DataState>
      <p className="text-xs text-muted">
        ⏳ Deadline · ◷ Applications open. Always confirm dates on the official page.
      </p>
    </div>
  );
}
