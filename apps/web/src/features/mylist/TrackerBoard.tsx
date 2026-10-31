import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ProgramWithStatus } from '@/features/programs/api';
import { cn } from '@/lib/cn';
import { trackerStatuses, useLocalStore, type TrackerStatus } from '@/stores/local';
import { checklistFor } from './checklist';
import { TRACKER_LABEL } from './TrackerDialog';

/** Kanban board of saved programs by application status. Drag on desktop, "Move to" menu everywhere. */
export function TrackerBoard({
  programs,
  onOpen,
}: {
  programs: ProgramWithStatus[];
  onOpen: (p: ProgramWithStatus) => void;
}) {
  const tracker = useLocalStore((s) => s.tracker);
  const updateEntry = useLocalStore((s) => s.updateEntry);
  const [dragOver, setDragOver] = useState<TrackerStatus | null>(null);
  const statusOf = (id: string): TrackerStatus => tracker[id]?.status ?? 'researching';

  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
      {trackerStatuses.map((status) => {
        const items = programs.filter((p) => statusOf(p.id) === status);
        return (
          <section
            key={status}
            aria-label={`${TRACKER_LABEL[status]}, ${items.length}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(status);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id) updateEntry(id, { status });
              setDragOver(null);
            }}
            className={cn(
              'flex w-64 shrink-0 snap-start flex-col gap-2 rounded-lg border bg-surface-2/60 p-2',
              dragOver === status ? 'border-primary' : 'border-border',
            )}
          >
            <h3 className="flex items-center justify-between px-1 text-sm font-semibold">
              {TRACKER_LABEL[status]}
              <span className="text-xs tabular-nums text-muted">{items.length}</span>
            </h3>
            {items.map((p) => {
              const checklist = checklistFor(p);
              const done = checklist.filter((i) => tracker[p.id]?.checklist[i.id]).length;
              return (
                <article
                  key={p.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                  className="flex cursor-grab flex-col gap-2 rounded-md border border-border bg-surface p-3 shadow-sm active:cursor-grabbing"
                >
                  <button type="button" onClick={() => onOpen(p)} className="text-left">
                    <span className="line-clamp-2 text-sm font-semibold hover:underline">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted">{p.university_name}</span>
                  </button>
                  <StatusBadge status={p.status} size="sm" className="self-start" />
                  <div className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span className="tabular-nums">
                      Docs {done}/{checklist.length}
                    </span>
                    <label className="sr-only" htmlFor={`move-${p.id}`}>
                      Move {p.name} to
                    </label>
                    <select
                      id={`move-${p.id}`}
                      value={status}
                      onChange={(e) =>
                        updateEntry(p.id, { status: e.target.value as TrackerStatus })
                      }
                      className="h-7 rounded-sm border border-border bg-surface px-1 text-xs"
                    >
                      {trackerStatuses.map((s) => (
                        <option key={s} value={s}>
                          {TRACKER_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              );
            })}
            {items.length === 0 && (
              <p className="px-1 py-4 text-center text-xs text-muted">Drop here</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
