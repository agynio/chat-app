import { filesGatewayClient, type UploadFileRequest } from '@/api/files-connect';
import type { FileRecord } from '@/api/types/files';

export type UploadProgressEvent = {
  loaded: number;
  total: number;
  progress?: number;
};

export type UploadProgressHandler = (event: UploadProgressEvent) => void;

const CHUNK_BYTES = 64 * 1024;

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('Upload aborted', 'AbortError');
}

async function* createUploadStream(
  file: File,
  onUploadProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): AsyncIterable<UploadFileRequest> {
  throwIfAborted(signal);
  yield {
    payload: {
      case: 'metadata',
      value: {
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size.toString(),
      },
    },
  };

  const buffer = new Uint8Array(await file.arrayBuffer());
  const total = buffer.length;
  let offset = 0;

  while (offset < total) {
    throwIfAborted(signal);
    const end = Math.min(offset + CHUNK_BYTES, total);
    const chunkData = buffer.subarray(offset, end);
    offset = end;
    yield {
      payload: {
        case: 'chunk',
        value: { data: chunkData },
      },
    };
    if (onUploadProgress) {
      onUploadProgress({
        loaded: offset,
        total,
        progress: total > 0 ? offset / total : 0,
      });
    }
  }
}

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
  const stream = createUploadStream(file, onUploadProgress, signal);
  const response = await filesGatewayClient.uploadFile(stream, { signal });
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
