import type { LucideIcon } from 'lucide-react';
import { Card } from '../ui/Card';
import { cn } from '../../lib/cn';

export type EmployeeKpiTone = 'ink' | 'amber' | 'success' | 'info';

const tones: Record<EmployeeKpiTone, { tile: string; dot: string }> = {
  ink: { tile: 'bg-cream text-ink', dot: 'bg-ink' },
  amber: { tile: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  success: { tile: 'bg-success-50 text-success-600', dot: 'bg-success-500' },
  info: { tile: 'bg-info-50 text-info-500', dot: 'bg-info-500' },
};

export function EmployeeKpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'ink',
  className,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: EmployeeKpiTone;
  className?: string;
}) {
  return (
    <Card
      padding="md"
      className={cn(
        'group min-w-0 transition-colors hover:border-line-strong',
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-ink-400">
          {label}
        </p>
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
            tones[tone].tile
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 truncate text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">
        {value}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[10px] leading-4 text-ink-400">
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tones[tone].dot)} />
        <span className="truncate">{hint}</span>
      </p>
    </Card>
  );
}
