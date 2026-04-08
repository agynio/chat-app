import { useEffect, useMemo, useState } from 'react';
import { buildDownloadUrl, buildProxyUrl, INLINE_IMAGE_MAX_SIZE } from '@/lib/media/proxy-url';
import { cn } from '@/lib/utils';
import { MediaDownloadLink } from './MediaDownloadLink';

type LoadState = 'loading' | 'loaded' | 'error';

interface MediaImageProps {
  src: string;
  alt?: string;
  title?: string;
  className?: string;
}

export function MediaImage({ src, alt = '', title, className = '' }: MediaImageProps) {
  const normalizedSrc = src.trim();
  const proxyUrl = useMemo(
    () => (normalizedSrc ? buildProxyUrl(normalizedSrc, { size: INLINE_IMAGE_MAX_SIZE }) : null),
    [normalizedSrc],
  );
  const downloadUrl = useMemo(
    () => (normalizedSrc ? buildDownloadUrl(normalizedSrc) : null),
    [normalizedSrc],
  );

  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!proxyUrl) return;
    setLoadState('loading');

    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) {
        setLoadState('loaded');
      }
    };
    image.onerror = () => {
      if (!cancelled) {
        setLoadState('error');
      }
    };
    image.src = proxyUrl;

    return () => {
      cancelled = true;
    };
  }, [proxyUrl, retryKey]);

  if (!proxyUrl) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <div className="rounded-[12px] border border-[var(--agyn-border-subtle)] bg-[var(--agyn-bg-light)] p-3 text-xs text-[var(--agyn-gray)]">
          {alt ? `Image unavailable: ${alt}` : 'Image unavailable.'}
        </div>
        <MediaDownloadLink href={downloadUrl} />
      </div>
    );
  }

  const handleRetry = () => {
    setLoadState('loading');
    setRetryKey((prev) => prev + 1);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative max-w-full">
        {loadState === 'loading' ? (
          <div className="h-48 w-full animate-pulse rounded-[12px] bg-[var(--agyn-bg-light)]" />
        ) : loadState === 'error' ? (
          <div className="flex flex-col gap-2 rounded-[12px] border border-[var(--agyn-border-subtle)] bg-[var(--agyn-bg-light)] p-3">
            <span className="text-xs text-[var(--agyn-gray)]">
              {alt ? `Image failed to load: ${alt}` : 'Image failed to load.'}
            </span>
            <button
              type="button"
              onClick={handleRetry}
              className="text-xs text-[var(--agyn-blue)] hover:text-[var(--agyn-purple)] underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <img
            key={retryKey}
            src={proxyUrl}
            alt={alt}
            title={title}
            loading="lazy"
            className="max-h-[360px] w-full rounded-[12px] border border-[var(--agyn-border-subtle)] object-contain"
          />
        )}
      </div>
      <MediaDownloadLink href={downloadUrl} />
    </div>
  );
}
