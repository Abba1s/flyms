import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Field colour shown as a 4 px left accent. */
  accentColor?: string;
}

export function Card({ accentColor, className, style, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-4 shadow-sm',
        accentColor && 'border-l-4',
        className,
      )}
      style={accentColor ? { ...style, borderLeftColor: accentColor } : style}
      {...props}
    />
  );
}
