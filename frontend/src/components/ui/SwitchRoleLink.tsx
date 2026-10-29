import { Link } from 'react-router-dom';
import { ArrowLeftRight } from 'lucide-react';
import { useAppRole } from '../../context/RoleContext';
import { cn } from '../../lib/cn';

export function SwitchRoleLink({
  dark = false,
  className,
}: {
  dark?: boolean;
  className?: string;
}) {
  const { clearRole } = useAppRole();
  return (
    <Link
      to="/"
      onClick={clearRole}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors',
        dark
          ? 'text-cream/60 hover:bg-white/10 hover:text-cream'
          : 'text-ink-400 hover:bg-line-soft hover:text-ink',
        className
      )}
    >
      <ArrowLeftRight className="h-3 w-3" />
      Switch role
    </Link>
  );
}
