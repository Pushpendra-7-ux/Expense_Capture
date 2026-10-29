import React from 'react';
import { cn } from '../../lib/cn';

type Padding = 'none' | 'sm' | 'md' | 'lg';
type Tone = 'surface' | 'dark' | 'amber' | 'plain';

const paddings: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

const tones: Record<Tone, string> = {
  surface: 'bg-white border border-line shadow-card',
  dark: 'bg-ink text-cream border border-ink shadow-card',
  amber: 'bg-amber-50 border border-amber-200',
  plain: 'bg-cream border border-line-soft',
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  tone?: Tone;
}

export function Card({
  padding = 'md',
  tone = 'surface',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn('rounded-2xl', tones[tone], paddings[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
}
