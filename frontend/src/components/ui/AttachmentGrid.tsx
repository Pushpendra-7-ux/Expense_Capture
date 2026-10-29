import { FileText, ExternalLink } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface AttachmentTile {
  id: string;
  url: string;
  name: string;
  mime: string;
}

export function AttachmentGrid({
  items,
  columns = 3,
  className,
}: {
  items: AttachmentTile[];
  columns?: 2 | 3;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        'grid gap-2',
        columns === 2 ? 'grid-cols-2' : 'grid-cols-3',
        className
      )}
    >
      {items.map((item) => {
        const isPdf = item.mime === 'application/pdf';
        return (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="group relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border border-line bg-cream transition-colors hover:border-line-strong"
            aria-label={`Open ${item.name}`}
          >
            {isPdf ? (
              <>
                <FileText className="h-6 w-6 text-ink-400" />
                <span className="mt-1.5 line-clamp-2 px-2 text-center text-[9px] font-semibold text-ink-500">
                  {item.name}
                </span>
              </>
            ) : (
              <img
                src={item.url}
                alt={item.name}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                loading="lazy"
              />
            )}
            <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-cream opacity-0 transition-opacity group-hover:opacity-100">
              <ExternalLink className="h-3 w-3" />
            </span>
          </a>
        );
      })}
    </div>
  );
}
