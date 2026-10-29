import React from 'react';
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '../../lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-amber-500', className)} />;
}

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-line-soft bg-white p-6',
        className
      )}
    >
      <Spinner />
      <p className="text-xs font-medium text-ink-400">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-cream/60 px-6 py-12 text-center',
        className
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink-400 shadow-card">
        {icon || <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-1 max-w-xs text-xs leading-5 text-ink-400">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-danger-100 bg-danger-50/60 px-6 py-10 text-center',
        className
      )}
    >
      <AlertCircle className="mb-3 h-6 w-6 text-danger-500" />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {message ? (
        <p className="mt-1 max-w-sm text-xs leading-5 text-ink-500">{message}</p>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function InlineAlert({
  tone = 'error',
  children,
  className,
}: {
  tone?: 'error' | 'warning' | 'success' | 'info';
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    error: 'border-danger-100 bg-danger-50 text-danger-600',
    warning: 'border-amber-200 bg-amber-50 text-amber-600',
    success: 'border-success-100 bg-success-50 text-success-600',
    info: 'border-line bg-cream text-ink-500',
  };
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-5',
        tones[tone],
        className
      )}
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
