import { ChevronIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  const btn =
    'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-40 disabled:hover:bg-surface';
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ChevronIcon dir="left" className="h-4 w-4" />
        <span className="hidden sm:inline">Previous</span>
      </button>
      <span className={cn('px-2 text-sm tabular-nums text-muted')} aria-current="page">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className={btn}
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronIcon className="h-4 w-4" />
      </button>
    </nav>
  );
}
