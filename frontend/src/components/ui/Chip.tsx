import React from 'react';
import { cn } from '../../lib/cn';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Chip({ selected = false, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2',
        selected
          ? 'border-ink bg-ink text-cream'
          : 'border-line bg-white text-ink-500 hover:border-line-strong hover:text-ink',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
