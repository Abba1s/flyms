import { Link } from 'react-router-dom';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { ProgramWithStatus } from '@/features/programs/api';
import { keyDateText } from '@/features/programs/ProgramCard';
import { trackerStatuses, useLocalStore, type TrackerStatus } from '@/stores/local';
import { checklistFor } from './checklist';

export const TRACKER_LABEL: Record<TrackerStatus, string> = {
  researching: 'Researching',
  preparing: 'Preparing documents',
  applied: 'Applied',
  interview: 'Interview / test',
  admitted: 'Admitted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function TrackerDialog({
  program,
  onClose,
}: {
  program: ProgramWithStatus | null;
  onClose: () => void;
}) {
  const tracker = useLocalStore((s) => (program ? s.tracker[program.id] : undefined));
  const updateEntry = useLocalStore((s) => s.updateEntry);
  const toggleChecklist = useLocalStore((s) => s.toggleChecklist);
  if (!program) return null;

  const status = tracker?.status ?? 'researching';
  const checklist = checklistFor(program);
  const done = checklist.filter((i) => tracker?.checklist[i.id]).length;

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={program.name}
      description={program.university_name}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={program.status} size="sm" />
          {keyDateText(program) && (
            <span className="text-sm text-muted">{keyDateText(program)}</span>
          )}
        </div>

        <Select
          label="Application status"
          value={status}
          onChange={(e) => updateEntry(program.id, { status: e.target.value as TrackerStatus })}
        >
          {trackerStatuses.map((s) => (
            <option key={s} value={s}>
              {TRACKER_LABEL[s]}
            </option>
          ))}
        </Select>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            Documents · {done}/{checklist.length}
          </legend>
          {checklist.map((item) => (
            <label
              key={item.id}
              className="flex items-start gap-3 rounded-md px-1 py-1 text-sm hover:bg-surface-2"
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]"
                checked={Boolean(tracker?.checklist[item.id])}
                onChange={() => toggleChecklist(program.id, item.id)}
              />
              <span>
                <span className={tracker?.checklist[item.id] ? 'text-muted line-through' : ''}>
                  {item.label}
                </span>
                {item.hint && <span className="block text-xs text-muted">{item.hint}</span>}
              </span>
            </label>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Notes
          <textarea
            value={tracker?.notes ?? ''}
            onChange={(e) => updateEntry(program.id, { notes: e.target.value })}
            rows={4}
            maxLength={4000}
            placeholder="Contacts, login details for the portal (no passwords!), reminders…"
            className="rounded-sm border border-border bg-surface px-3 py-2 font-normal focus:border-primary focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap gap-4 text-sm font-semibold">
          <Link to={`/programs/${program.slug}`} className="text-primary hover:underline">
            Program details
          </Link>
          <Link to={`/sop/new?program=${program.id}`} className="text-primary hover:underline">
            Write SOP
          </Link>
          <a
            href={program.application_url ?? program.official_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Apply ↗
          </a>
        </div>
      </div>
    </Dialog>
  );
}
