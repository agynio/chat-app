import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getFileMetadata } from '@/api/modules/files';
import type { FileRecord } from '@/api/types/files';
import { buildDownloadUrl } from '@/lib/media/proxy-url';
import { cn } from '@/lib/utils';
import { MediaAudio } from './MediaAudio';
import { MediaFallback } from './MediaFallback';
import { MediaImage } from './MediaImage';
import { MediaVideo } from './MediaVideo';

interface MessageAttachmentsProps {
  fileIds: string[];
  className?: string;
}

const buildAgynFileUrl = (fileId: string) => `agyn://file/${fileId}`;

const resolveMediaType = (contentType: string): 'image' | 'video' | 'audio' | 'other' => {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType.startsWith('video/')) return 'video';
  if (contentType.startsWith('audio/')) return 'audio';
  return 'other';
};

const renderFileAttachment = (file: FileRecord) => {
  const fileUrl = buildAgynFileUrl(file.id);
  const mediaType = resolveMediaType(file.contentType);

  if (mediaType === 'image') {
    return <MediaImage src={fileUrl} alt={file.filename} />;
  }

  if (mediaType === 'video') {
    return <MediaVideo src={fileUrl} label={file.filename} />;
  }

  if (mediaType === 'audio') {
    return <MediaAudio src={fileUrl} label={file.filename} />;
  }

  return (
    <MediaFallback
      filename={file.filename}
      contentType={file.contentType}
      sizeBytes={file.sizeBytes}
      downloadUrl={buildDownloadUrl(fileUrl)}
    />
  );
};

export function MessageAttachments({ fileIds, className = '' }: MessageAttachmentsProps) {
  const resolvedFileIds = useMemo(() => fileIds.filter(Boolean), [fileIds]);

  const queries = useQueries({
    queries: resolvedFileIds.map((fileId) => ({
      queryKey: ['files', 'metadata', fileId],
      queryFn: () => getFileMetadata(fileId),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });

  if (resolvedFileIds.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="message-attachments">
      {resolvedFileIds.map((fileId, index) => {
        const query = queries[index];
        const fallbackUrl = buildDownloadUrl(buildAgynFileUrl(fileId));

        if (!query || query.isLoading) {
          return (
            <div
              key={fileId}
              className="h-24 w-full animate-pulse rounded-[12px] border border-[var(--agyn-border-subtle)] bg-[var(--agyn-bg-light)]"
            />
          );
        }

        if (query.isError || !query.data) {
          return (
            <MediaFallback
              key={fileId}
              filename={fileId}
              description="Failed to load file metadata."
              downloadUrl={fallbackUrl}
            />
          );
        }

        return (
          <div key={fileId} className="min-w-0">
            {renderFileAttachment(query.data)}
          </div>
        );
      })}
    </div>
  );
}
