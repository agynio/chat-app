import { useEffect, useMemo, useState } from 'react';
import { buildDownloadUrl, buildProxyUrl } from '@/lib/media/proxy-url';
import { cn } from '@/lib/utils';
import { MediaDownloadLink } from './MediaDownloadLink';
import { MediaFallback } from './MediaFallback';

interface MediaAudioProps {
  src: string;
  label?: string;
  className?: string;
}

export function MediaAudio({ src, label = 'Audio', className = '' }: MediaAudioProps) {
  const normalizedSrc = src.trim();
  const proxyUrl = useMemo(() => (normalizedSrc ? buildProxyUrl(normalizedSrc) : null), [normalizedSrc]);
  const downloadUrl = useMemo(() => (normalizedSrc ? buildDownloadUrl(normalizedSrc) : null), [normalizedSrc]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [proxyUrl]);

  if (!proxyUrl || hasError) {
    return (
      <div className={cn('flex flex-col gap-2', className)} data-testid="media-audio">
        <MediaFallback
          filename={label}
          description={hasError ? 'Audio failed to load.' : 'Audio unavailable.'}
          downloadUrl={downloadUrl}
        />
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} data-testid="media-audio">
      <audio
        className="w-full"
        controls
        preload="metadata"
        src={proxyUrl}
        onError={() => setHasError(true)}
        data-testid="media-audio-element"
      />
      <MediaDownloadLink href={downloadUrl} />
    </div>
  );
}
