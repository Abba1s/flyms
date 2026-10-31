import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { MAX_COMPARE, useLocalStore } from '@/stores/local';

export function CompareToggle({ programId, className }: { programId: string; className?: string }) {
  const selected = useLocalStore((s) => s.compareIds.includes(programId));
  const toggle = useLocalStore((s) => s.toggleCompare);
  const toast = useToast();
  return (
    <label
      className={cn(
        'relative z-10 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-muted',
        className,
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => {
          if (!toggle(programId)) toast(`You can compare up to ${MAX_COMPARE} programs`);
        }}
        className="h-4 w-4 accent-[rgb(var(--primary))]"
      />
      Compare
    </label>
  );
}

/** Floating bar shown while programs are selected for comparison. */
export function CompareBar() {
  const count = useLocalStore((s) => s.compareIds.length);
  const clear = useLocalStore((s) => s.clearCompare);
  if (count === 0) return null;
  return (
    <div className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 shadow-lg md:bottom-6">
      <span className="text-sm font-medium">{count} selected</span>
      <Link
        to="/compare"
        className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-contrast"
      >
        Compare
      </Link>
      <button type="button" onClick={clear} className="text-sm text-muted hover:text-text">
        Clear
      </button>
    </div>
  );
}
