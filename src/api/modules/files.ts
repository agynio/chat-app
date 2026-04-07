import { connectPost } from '@/api/connect';
import { uploadFileViaConnect } from '@/api/upload-file-connect';
import type { FileRecord, FileMetadata, GetFileMetadataRequest, GetFileMetadataResponse } from '@/api/types/files';
import type { UploadProgressHandler } from '@/api/types/upload';

export type { UploadProgressEvent, UploadProgressHandler } from '@/api/types/upload';

const FILES_SERVICE = '/api/agynio.api.gateway.v1.FilesGateway';

type FileMetadataWire = {
  id?: string;
  filename?: string;
  contentType?: string;
  sizeBytes?: string | number | bigint;
  createdAt?: string;
};

function parseSizeBytes(sizeBytes: string | number | bigint): number {
  const parsed = typeof sizeBytes === 'bigint'
    ? Number(sizeBytes)
    : typeof sizeBytes === 'number'
      ? sizeBytes
      : Number.parseInt(sizeBytes, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid sizeBytes: ${sizeBytes}`);
  }
  return parsed;
}

function normalizeFileRecord(file: FileMetadataWire): FileRecord {
  if (!file.id) {
    throw new Error('File metadata missing id');
  }
  if (!file.filename) {
    throw new Error('File metadata missing filename');
  }
  if (!file.contentType) {
    throw new Error('File metadata missing contentType');
  }
  if (file.sizeBytes === undefined) {
    throw new Error('File metadata missing sizeBytes');
  }
  if (!file.createdAt) {
    throw new Error('File metadata missing createdAt');
  }

  return {
    id: file.id,
    filename: file.filename,
    contentType: file.contentType,
    sizeBytes: parseSizeBytes(file.sizeBytes),
    createdAt: file.createdAt,
  } satisfies FileRecord;
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

  return normalizeFileRecord(response.file as FileMetadataWire);
}

export async function getFileMetadata(fileId: string): Promise<FileRecord> {
  const response = await connectPost<GetFileMetadataRequest, GetFileMetadataResponse>(
    FILES_SERVICE,
    'GetFileMetadata',
    { fileId },
  );

  const file = response.file ?? (response as unknown as FileMetadata);
  if (!file) {
    throw new Error('GetFileMetadata response missing file');
  }

  return normalizeFileRecord(file as FileMetadataWire);
}
