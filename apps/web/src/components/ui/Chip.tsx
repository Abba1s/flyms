import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  selected?: boolean;
  /** Optional colour dot (e.g. field colour as a hex string). */
  dotColor?: string;
  children: ReactNode;
}

export function Chip({ selected = false, dotColor, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors duration-150',
        selected
          ? 'border-primary bg-primary/12 text-primary'
          : 'border-border bg-surface text-text hover:bg-surface-2',
        className,
      )}
      {...props}
    >
      {dotColor && (
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
      )}
      {children}
      {selected && (
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      )}
    </button>
  );
}
