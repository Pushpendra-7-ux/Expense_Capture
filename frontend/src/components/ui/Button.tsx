import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'amber';
type Size = 'sm' | 'md' | 'lg';

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-cream border border-ink hover:bg-ink-800 active:bg-ink-800 disabled:bg-ink-400 disabled:border-ink-400',
  secondary:
    'bg-white text-ink border border-line hover:border-line-strong hover:bg-cream active:bg-line-soft disabled:text-ink-400',
  ghost:
    'bg-transparent text-ink-500 border border-transparent hover:bg-line-soft hover:text-ink active:bg-line',
  danger:
    'bg-danger-500 text-white border border-danger-500 hover:bg-danger-600 active:bg-danger-600 disabled:bg-danger-100 disabled:text-danger-500 disabled:border-danger-100',
  success:
    'bg-success-500 text-white border border-success-500 hover:bg-success-600 active:bg-success-600 disabled:bg-success-100 disabled:text-success-500 disabled:border-success-100',
  amber:
    'bg-amber-100 text-ink border border-amber-200 hover:bg-amber-200 active:bg-amber-200',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-3 text-xs gap-1.5 rounded-xl',
  md: 'h-11 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-sm gap-2 rounded-2xl',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md') {
  return cn(
    'inline-flex items-center justify-center font-semibold transition-colors select-none',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
    'disabled:cursor-not-allowed',
    variants[variant],
    sizes[size]
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonClasses(variant, size), fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
