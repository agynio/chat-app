import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { getAccessToken } from '@/auth';
import { config } from '@/config';
import {
  uploadFileRequestDesc,
  uploadFileResponseDesc,
  type UploadFileRequest,
  type UploadFileResponse,
} from '@/api/files-connect';

type UploadProgressEvent = {
  loaded: number;
  total: number;
  progress?: number;
};

type UploadProgressHandler = (event: UploadProgressEvent) => void;

type EndStreamResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

const CHUNK_BYTES = 64 * 1024;
const CONNECT_CONTENT_TYPE = 'application/connect+proto';
const CONNECT_PROTOCOL_VERSION = '1';
const UPLOAD_PATH = '/api/agynio.api.gateway.v1.FilesGateway/UploadFile';

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('Upload aborted', 'AbortError');
}

function createEnvelope(payload: Uint8Array, flags = 0x00): Uint8Array {
  const envelope = new Uint8Array(5 + payload.length);
  envelope[0] = flags;
  const view = new DataView(envelope.buffer, envelope.byteOffset, envelope.byteLength);
  view.setUint32(1, payload.length, false);
  envelope.set(payload, 5);
  return envelope;
}

function concatEnvelopes(envelopes: Uint8Array[]): Uint8Array {
  const total = envelopes.reduce((sum, envelope) => sum + envelope.length, 0);
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const envelope of envelopes) {
    combined.set(envelope, offset);
    offset += envelope.length;
  }
  return combined;
}

function readEnvelope(buffer: Uint8Array, offset: number) {
  if (offset + 5 > buffer.length) {
    throw new Error('Connect response envelope is truncated');
  }
  const flags = buffer[offset];
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset + 1, 4);
  const length = view.getUint32(0, false);
  const start = offset + 5;
  const end = start + length;
  if (end > buffer.length) {
    throw new Error('Connect response payload is truncated');
  }
  return { flags, data: buffer.subarray(start, end), nextOffset: end };
}

function parseEndStream(data: Uint8Array): void {
  if (data.length === 0) return;
  let payload: EndStreamResponse;
  try {
    payload = JSON.parse(new TextDecoder().decode(data)) as EndStreamResponse;
  } catch (error) {
    throw new Error('Failed to parse Connect end-stream response', { cause: error });
  }
  if (!payload.error) return;
  const code = payload.error.code ?? 'unknown';
  const message = payload.error.message ?? 'UploadFile failed';
  throw new Error(`UploadFile failed (${code}): ${message}`);
}

function buildRequestMessage(payload: UploadFileRequest): Uint8Array {
  const message = create(uploadFileRequestDesc, payload);
  return toBinary(uploadFileRequestDesc, message);
}

export async function uploadFileViaConnect(
  file: File,
  onUploadProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): Promise<UploadFileResponse> {
  throwIfAborted(signal);

  const envelopes: Uint8Array[] = [];
  envelopes.push(
    createEnvelope(
      buildRequestMessage({
        payload: {
          case: 'metadata',
          value: {
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size.toString(),
          },
        },
      }),
    ),
  );

  const buffer = new Uint8Array(await file.arrayBuffer());
  const total = buffer.length;
  let offset = 0;

  while (offset < total) {
    throwIfAborted(signal);
    const end = Math.min(offset + CHUNK_BYTES, total);
    const chunkData = buffer.subarray(offset, end);
    offset = end;
    envelopes.push(
      createEnvelope(
        buildRequestMessage({
          payload: {
            case: 'chunk',
            value: { data: chunkData },
          },
        }),
      ),
    );
    if (onUploadProgress) {
      onUploadProgress({
        loaded: offset,
        total,
        progress: total > 0 ? offset / total : 0,
      });
    }
  }

  const token = await getAccessToken();
  const headers = new Headers({
    'Content-Type': CONNECT_CONTENT_TYPE,
    'Connect-Protocol-Version': CONNECT_PROTOCOL_VERSION,
  });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  throwIfAborted(signal);
  const response = await fetch(`${config.apiBaseUrl}${UPLOAD_PATH}`, {
    method: 'POST',
    headers,
    body: concatEnvelopes(envelopes),
    signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`UploadFile failed with status ${response.status}: ${body}`);
  }

  const bodyBuffer = new Uint8Array(await response.arrayBuffer());
  if (bodyBuffer.length === 0) {
    throw new Error('UploadFile response body was empty');
  }

  const firstEnvelope = readEnvelope(bodyBuffer, 0);
  if (firstEnvelope.flags !== 0x00) {
    throw new Error(`Unexpected response envelope flags: ${firstEnvelope.flags}`);
  }
  const message = fromBinary(uploadFileResponseDesc, firstEnvelope.data) as UploadFileResponse;

  const endEnvelope = readEnvelope(bodyBuffer, firstEnvelope.nextOffset);
  if (endEnvelope.flags !== 0x02) {
    throw new Error(`Unexpected end-stream flags: ${endEnvelope.flags}`);
  }
  parseEndStream(endEnvelope.data);

  if (endEnvelope.nextOffset !== bodyBuffer.length) {
    throw new Error('UploadFile response contained extra data');
  }

  return message;
}
