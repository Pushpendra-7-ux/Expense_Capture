import { Sparkles } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/States';

export function AnalysisModal({
  open,
  title = 'Reading your bill',
}: {
  open: boolean;
  title?: string;
}) {
  return (
    <Modal open={open} onClose={() => undefined} hideClose size="sm">
      <div className="flex flex-col items-center px-2 py-4 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <Sparkles className="h-5 w-5" />
        </span>
        <p className="text-sm font-bold text-ink">{title}</p>
        <p className="mt-1 text-xs text-ink-400">Gemini is filling the draft.</p>
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-line-soft">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-amber-500" />
        </div>
        <div className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          <Spinner className="h-3.5 w-3.5" />
          Usually 30 seconds
        </div>
      </div>
    </Modal>
  );
}
