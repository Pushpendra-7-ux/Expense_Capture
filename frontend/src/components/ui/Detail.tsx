import React from 'react';
import { cn } from '../../lib/cn';

export function DetailGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <dl className={cn('grid grid-cols-2 gap-x-4 gap-y-4', className)}>{children}</dl>;
}

export function Detail({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-400">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 break-words text-xs font-semibold leading-5 text-ink',
          mono && 'font-mono text-[11px]'
        )}
      >
        {value || '—'}
      </dd>
    </div>
  );
}
