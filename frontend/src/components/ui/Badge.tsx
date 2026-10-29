import React from 'react';
import { cn } from '../../lib/cn';
import type { StatusTone } from '../../lib/status';

type BadgeTone = StatusTone | 'dark' | 'amber';

const tones: Record<BadgeTone, string> = {
  success: 'bg-success-50 text-success-600 border-success-100',
  warning: 'bg-amber-50 text-amber-600 border-amber-200',
  danger: 'bg-danger-50 text-danger-600 border-danger-100',
  info: 'bg-info-50 text-info-500 border-line',
  neutral: 'bg-cream text-ink-500 border-line',
  dark: 'bg-ink text-cream border-ink',
  amber: 'bg-amber-100 text-ink border-amber-200',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  dotClassName?: string;
}

export function Badge({
  tone = 'neutral',
  dot = false,
  dotClassName,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] whitespace-nowrap',
        tones[tone],
        className
      )}
      {...props}
    >
      {dot ? (
        <span className={cn('h-1.5 w-1.5 rounded-full bg-current', dotClassName)} />
      ) : null}
      {children}
    </span>
  );
}
