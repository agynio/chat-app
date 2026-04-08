import { useEffect, useMemo, useState } from 'react';
import { buildDownloadUrl, buildProxyUrl } from '@/lib/media/proxy-url';
import { cn } from '@/lib/utils';
import { MediaDownloadLink } from './MediaDownloadLink';
import { MediaFallback } from './MediaFallback';

interface MediaVideoProps {
  src: string;
  label?: string;
  className?: string;
}

export function MediaVideo({ src, label = 'Video', className = '' }: MediaVideoProps) {
  const normalizedSrc = src.trim();
  const proxyUrl = useMemo(() => (normalizedSrc ? buildProxyUrl(normalizedSrc) : null), [normalizedSrc]);
  const downloadUrl = useMemo(() => (normalizedSrc ? buildDownloadUrl(normalizedSrc) : null), [normalizedSrc]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [proxyUrl]);

  if (!proxyUrl || hasError) {
    return (
      <div className={cn('flex flex-col gap-2', className)} data-testid="media-video">
        <MediaFallback
          filename={label}
          description={hasError ? 'Video failed to load.' : 'Video unavailable.'}
          downloadUrl={downloadUrl}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="media-video">
      <video
        className="w-full rounded-[12px] border border-[var(--agyn-border-subtle)] bg-black"
        controls
        preload="metadata"
        src={proxyUrl}
        onError={() => setHasError(true)}
        data-testid="media-video-element"
      />
      <MediaDownloadLink href={downloadUrl} />
    </div>
  );
}
