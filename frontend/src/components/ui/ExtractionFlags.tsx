import { AlertTriangle, Sparkles } from 'lucide-react';
import type { ExtractionSummary } from '../../lib/extraction';
import { extractionFlags } from '../../lib/extraction';

export function ExtractionFlags({
  summary,
  className = '',
}: {
  summary: ExtractionSummary;
  className?: string;
}) {
  const flags = extractionFlags(summary);
  if (flags.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border border-amber-200 bg-amber-50 p-3.5 ${className}`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-600">
          AI flags
        </p>
      </div>
      <ul className="space-y-1.5">
        {flags.map((flag) => (
          <li key={flag} className="flex items-start gap-2 text-[11px] leading-5 text-ink-500">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
            <span>{flag}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
