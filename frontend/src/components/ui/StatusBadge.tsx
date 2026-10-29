import { Badge } from './Badge';
import { statusMeta } from '../../lib/status';
import { cn } from '../../lib/cn';

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const meta = statusMeta(status);
  return (
    <Badge tone={meta.tone} dot dotClassName={meta.dot} className={cn(className)}>
      {meta.label}
    </Badge>
  );
}
