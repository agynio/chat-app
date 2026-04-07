import { uploadFileViaConnect } from '@/api/upload-file-connect';
import type { FileRecord } from '@/api/types/files';
import type { UploadProgressHandler } from '@/api/types/upload';

export type { UploadProgressEvent, UploadProgressHandler } from '@/api/types/upload';

function parseSizeBytes(sizeBytes: string | bigint): number {
  const parsed = typeof sizeBytes === 'bigint' ? Number(sizeBytes) : Number.parseInt(sizeBytes, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid sizeBytes: ${sizeBytes}`);
  }
  return parsed;
}

export async function uploadFile(
  file: File,
  onUploadProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): Promise<FileRecord> {
  const response = await uploadFileViaConnect(file, onUploadProgress, signal);
  if (!response.file) {
    throw new Error('UploadFile response missing file');
  }

  return {
    id: response.file.id,
    filename: response.file.filename,
    contentType: response.file.contentType,
    sizeBytes: parseSizeBytes(response.file.sizeBytes),
    createdAt: response.file.createdAt,
  } satisfies FileRecord;
}
