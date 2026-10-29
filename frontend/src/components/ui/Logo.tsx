import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

export function Logo({
  compact = false,
  dark = false,
  className,
}: {
  compact?: boolean;
  dark?: boolean;
  className?: string;
}) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2.5', className)}
      aria-label="Dexter Capital home"
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl text-sm font-extrabold',
          dark ? 'bg-cream text-ink' : 'bg-ink text-cream'
        )}
      >
        D
      </span>
      {compact ? null : (
        <span className="leading-tight">
          <span
            className={cn(
              'block text-[11px] font-bold tracking-[0.12em]',
              dark ? 'text-cream' : 'text-ink'
            )}
          >
            DEXTER CAPITAL
          </span>
          <span
            className={cn(
              'block text-[9px] font-semibold tracking-[0.14em]',
              dark ? 'text-cream/50' : 'text-ink-400'
            )}
          >
            OPE LEDGER
          </span>
        </span>
      )}
    </Link>
  );
}
