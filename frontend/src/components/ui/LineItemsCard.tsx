import { AlertTriangle, ReceiptText } from 'lucide-react';
import { formatINR } from '../../lib/format';
import type { ExtractedLineItemView } from '../../lib/extraction';
import { cn } from '../../lib/cn';

export function LineItemsCard({
  items,
  claimedAmountMinor,
  title = 'Line items',
  subtitle,
  className,
}: {
  items: ExtractedLineItemView[];
  claimedAmountMinor?: number | null;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  if (items.length === 0) return null;

  const totalMinor = items.reduce((sum, item) => sum + (item.amountMinor || 0), 0);
  const allRead = items.every(
    (item) => item.amountMinor !== null && item.amountMinor !== undefined
  );
  const claim =
    typeof claimedAmountMinor === 'number' && claimedAmountMinor > 0
      ? claimedAmountMinor
      : null;
  const mismatch =
    allRead && claim !== null && Math.abs(totalMinor - claim) > 100;
  const missingCount = items.filter((item) => item.amountMinor === null).length;

  return (
    <div className={cn('rounded-2xl border border-line bg-white', className)}>
      <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <ReceiptText className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-ink">{title}</p>
          <p className="truncate text-[10px] text-ink-400">
            {subtitle ||
              (allRead
                ? `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`
                : `${missingCount} ${missingCount === 1 ? 'entry' : 'entries'} without an amount`)}
          </p>
        </div>
        <span className="rounded-full border border-line bg-cream px-2.5 py-1 text-[11px] font-bold text-ink">
          {formatINR(totalMinor)}
        </span>
      </div>

      <div className="divide-y divide-line-soft">
        {items.map((item, index) => (
          <div
            key={`${item.description}-${index}`}
            className="flex items-center gap-3 px-4 py-2.5 text-xs"
          >
            <span className="w-5 font-mono text-[10px] text-ink-400">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{item.description}</span>
            <span className="font-semibold tabular-nums text-ink">
              {item.amountMinor !== null ? formatINR(item.amountMinor) : '—'}
            </span>
          </div>
        ))}
      </div>

      {mismatch || !allRead ? (
        <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-4 py-2.5 text-[10px] leading-4 text-amber-600">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {!allRead
              ? 'Some item amounts are unreadable. Check the bill.'
              : `Items total ${formatINR(totalMinor)}, claim reads ${formatINR(
                  claim || 0
                )}. Verify both.`}
          </span>
        </div>
      ) : null}
    </div>
  );
}
