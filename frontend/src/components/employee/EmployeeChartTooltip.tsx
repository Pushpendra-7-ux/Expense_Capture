import { formatINR } from '../../lib/format';

interface TooltipPayloadItem {
  value?: number | string;
  payload?: {
    fullLabel?: string;
  } & Record<string, unknown>;
}

interface EmployeeChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadItem[];
  valueLabel?: string;
}

/** A compact, on-theme tooltip for the new employee charts. */
export function EmployeeChartTooltip({
  active,
  label,
  payload,
  valueLabel = 'Claimed',
}: EmployeeChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0];
  const value = Number(point?.value || 0);

  return (
    <div className="min-w-[132px] rounded-xl border border-line bg-white px-3 py-2.5 shadow-lift">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-400">
        {point?.payload?.fullLabel || label}
      </p>
      <p className="mt-1 text-sm font-bold tabular-nums text-ink">
        {formatINR(value * 100)}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-[9px] font-medium text-ink-400">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {valueLabel}
      </p>
    </div>
  );
}
