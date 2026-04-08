import { cn } from '@/lib/utils';

interface MediaDownloadLinkProps {
  href?: string | null;
  label?: string;
  className?: string;
}

export function MediaDownloadLink({
  href,
  label = 'Download original',
  className = '',
}: MediaDownloadLinkProps) {
  if (!href) {
    return (
      <span
        className={cn('text-xs text-[var(--agyn-gray)]', className)}
        data-testid="media-download-link"
      >
        Download unavailable
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'text-xs text-[var(--agyn-blue)] hover:text-[var(--agyn-purple)] underline transition-colors',
        className,
      )}
      data-testid="media-download-link"
    >
      {label}
    </a>
  );
}
