import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

const fieldClasses =
  'w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink placeholder:text-ink-400/70 transition-colors focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100 disabled:bg-cream disabled:text-ink-400';

interface FieldShellProps {
  label?: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-3">
          <label
            htmlFor={htmlFor}
            className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-500"
          >
            {label}
          </label>
          {optional ? (
            <span className="text-[10px] font-medium text-ink-400">Optional</span>
          ) : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger-500">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-400">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  leading?: React.ReactNode;
}

export function Input({
  label,
  hint,
  error,
  optional,
  leading,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} optional={optional}>
      <div className="relative">
        {leading ? (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400">
            {leading}
          </span>
        ) : null}
        <input
          id={inputId}
          className={cn(
            fieldClasses,
            'h-11',
            Boolean(leading) && 'pl-10',
            error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-100',
            className
          )}
          {...props}
        />
      </div>
    </Field>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
}

export function Textarea({
  label,
  hint,
  error,
  optional,
  className,
  id,
  ...props
}: TextareaProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} optional={optional}>
      <textarea
        id={inputId}
        className={cn(
          fieldClasses,
          'min-h-24 resize-y py-3',
          error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-100',
          className
        )}
        {...props}
      />
    </Field>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Select({
  label,
  hint,
  error,
  className,
  id,
  children,
  ...props
}: SelectProps) {
  const generatedId = React.useId();
  const inputId = id || generatedId;

  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error}>
      <div className="relative">
        <select
          id={inputId}
          className={cn(fieldClasses, 'h-11 appearance-none pr-9', className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400"
        />
      </div>
    </Field>
  );
}
