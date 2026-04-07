import { File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/utils/formatFileSize';
import { MediaDownloadLink } from './MediaDownloadLink';

interface MediaFallbackProps {
  filename: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  downloadUrl?: string | null;
  description?: string;
  downloadLabel?: string;
  className?: string;
}

export function MediaFallback({
  filename,
  contentType,
  sizeBytes,
  downloadUrl,
  description,
  downloadLabel = 'Download file',
  className = '',
}: MediaFallbackProps) {
  const metadataParts = [contentType, sizeBytes ? formatFileSize(sizeBytes) : null].filter(Boolean);
  const metadata = description ?? (metadataParts.length > 0 ? metadataParts.join(' | ') : 'File');

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[12px] border border-[var(--agyn-border-subtle)] bg-white p-3',
        className,
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--agyn-bg-light)]">
        <File className="h-5 w-5 text-[var(--agyn-gray)]" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-[var(--agyn-dark)]" title={filename}>
          {filename}
        </div>
        <div className="text-xs text-[var(--agyn-gray)]">
          {metadata}
        </div>
      </div>
      <MediaDownloadLink href={downloadUrl} label={downloadLabel} />
    </div>
  );
}
