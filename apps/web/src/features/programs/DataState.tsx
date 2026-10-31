import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface DataStateProps {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  children: ReactNode;
}

/** Skeletons while loading, a retry message on error, otherwise the content. */
export function DataState({ isPending, isError, onRetry, children }: DataStateProps) {
  if (isPending) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-busy="true"
        aria-label="Loading"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-danger/40 bg-surface p-5"
      >
        <p className="font-semibold">We couldn&apos;t load programs.</p>
        <p className="text-sm text-muted">Check your connection and try again.</p>
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  return <>{children}</>;
}
