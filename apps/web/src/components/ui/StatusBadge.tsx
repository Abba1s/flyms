import { closingBucket, type AdmissionStatus, type IntakeStatus } from '@flyms/shared';
import { cn } from '@/lib/cn';
import { countdownText, statusLabel } from '@/lib/format';

const tone: Record<AdmissionStatus, string> = {
  closing_soon: 'bg-st-closing/12 text-st-closing',
  open: 'bg-st-open/12 text-st-open',
  opening_soon: 'bg-st-opening/12 text-st-opening',
  closed: 'bg-st-closed/12 text-st-closed',
  unknown: 'border border-dashed border-st-unknown text-muted',
};

export function StatusIcon({ status, className }: { status: AdmissionStatus; className?: string }) {
  const common = { className: cn('h-3.5 w-3.5 shrink-0', className), 'aria-hidden': true } as const;
  switch (status) {
    case 'open':
      return (
        <svg viewBox="0 0 16 16" {...common}>
          <circle cx="8" cy="8" r="5" fill="currentColor" />
        </svg>
      );
    case 'closing_soon':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" {...common}>
          <path d="M4 2h8M4 14h8M5 2c0 4 6 4 6 6s-6 2-6 6M11 2c0 4-6 4-6 6s6 2 6 6" />
        </svg>
      );
    case 'opening_soon':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5V8l2.5 1.5" />
        </svg>
      );
    case 'closed':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" {...common}>
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'unknown':
      return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" {...common}>
          <path d="M6 6a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2V10M8 12.5v.01" />
        </svg>
      );
  }
}

export interface StatusBadgeProps {
  status: IntakeStatus;
  size?: 'sm' | 'md';
  className?: string;
}

/** Status is always conveyed by icon + text, never colour alone. */
export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const label = statusLabel(status);
  const countdown = countdownText(status);
  // The last 3 days get a solid fill so they stand out from the 7- and 15-day buckets.
  const urgent = status.status === 'closing_soon' && closingBucket(status.daysLeft) === 3;
  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-x-1.5 rounded-sm font-semibold tabular-nums',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs',
        urgent ? 'bg-st-closing text-white' : tone[status.status],
        className,
      )}
    >
      <StatusIcon status={status.status} />
      <span className="whitespace-nowrap">{label}</span>
      {countdown && <span className="whitespace-nowrap font-medium">· {countdown}</span>}
    </span>
  );
}

/** Shown next to a status when no source or admin has confirmed the deadline recently. */
export function UnverifiedBadge({ className }: { className?: string }) {
  return (
    <span
      title="We could not confirm this deadline with an official source recently. Check the university's website before applying."
      className={cn(
        'inline-flex items-center gap-1 rounded-sm border border-dashed border-st-unknown px-1.5 py-0.5 text-xs font-medium text-muted',
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-3 w-3 shrink-0"
        aria-hidden
      >
        <path d="M8 2 1.5 13.5h13L8 2ZM8 6.5v3M8 11.5v.01" />
      </svg>
      Deadline not verified
    </span>
  );
}
