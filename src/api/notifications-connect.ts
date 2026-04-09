import { getAccessToken } from '@/auth';
import { config } from '@/config';
import { isRecord } from '@/api/parsing';

const CONNECT_CONTENT_TYPE = 'application/connect+json';
const CONNECT_PROTOCOL_VERSION = '1';
const SUBSCRIBE_PATH = '/api/agynio.api.gateway.v1.NotificationsGateway/Subscribe';

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

type EndStreamResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type NotificationEnvelope = {
  event: string;
  rooms: string[];
  payload: Record<string, unknown> | null;
};

export type MessageCreatedNotification = {
  threadId: string;
  messageId: string | null;
  senderId: string | null;
};

function createEnvelope(payload: Uint8Array, flags = 0x00): Uint8Array {
  const envelope = new Uint8Array(5 + payload.length);
  envelope[0] = flags;
  const view = new DataView(envelope.buffer, envelope.byteOffset, envelope.byteLength);
  view.setUint32(1, payload.length, false);
  envelope.set(payload, 5);
  return envelope;
}

function tryReadEnvelope(buffer: Uint8Array, offset: number) {
  if (offset + 5 > buffer.length) return null;
  const flags = buffer[offset];
  const view = new DataView(buffer.buffer, buffer.byteOffset + offset + 1, 4);
  const length = view.getUint32(0, false);
  const start = offset + 5;
  const end = start + length;
  if (end > buffer.length) return null;
  return { flags, data: buffer.subarray(start, end), nextOffset: end };
}

function concatBuffers(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b;
  const combined = new Uint8Array(a.length + b.length);
  combined.set(a, 0);
  combined.set(b, a.length);
  return combined;
}

function parseEndStream(data: Uint8Array): void {
  if (data.length === 0) return;
  let payload: EndStreamResponse;
  try {
    payload = JSON.parse(textDecoder.decode(data)) as EndStreamResponse;
  } catch (error) {
    throw new Error('Failed to parse Connect end-stream response', { cause: error });
  }
  if (!payload.error) return;
  const code = payload.error.code ?? 'unknown';
  const message = payload.error.message ?? 'Notifications subscribe failed';
  throw new Error(`Notifications subscribe failed (${code}): ${message}`);
}

function parseNotificationEnvelope(value: unknown): NotificationEnvelope | null {
  if (!isRecord(value)) return null;
  const envelope = value.envelope;
  if (!isRecord(envelope)) return null;
  const event = typeof envelope.event === 'string' ? envelope.event : null;
  if (!event) return null;
  const rooms = Array.isArray(envelope.rooms)
    ? envelope.rooms.filter((room) => typeof room === 'string')
    : [];
  const payload = isRecord(envelope.payload) ? envelope.payload : null;
  return { event, rooms, payload };
}

export function parseMessageCreatedNotification(
  envelope: NotificationEnvelope,
): MessageCreatedNotification | null {
  if (envelope.event !== 'message.created') return null;
  const payload = envelope.payload;
  if (!payload) return null;
  const threadId = typeof payload.thread_id === 'string' ? payload.thread_id : null;
  if (!threadId) return null;
  const messageId = typeof payload.message_id === 'string' ? payload.message_id : null;
  const senderId = typeof payload.sender_id === 'string' ? payload.sender_id : null;
  return { threadId, messageId, senderId };
}

export async function* subscribeNotifications(
  signal: AbortSignal,
): AsyncGenerator<NotificationEnvelope> {
  const token = await getAccessToken();
  const headers = new Headers({
    'Content-Type': CONNECT_CONTENT_TYPE,
    'Connect-Protocol-Version': CONNECT_PROTOCOL_VERSION,
    Accept: CONNECT_CONTENT_TYPE,
  });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const requestBody = createEnvelope(textEncoder.encode(JSON.stringify({})));
  const response = await fetch(`${config.apiBaseUrl}${SUBSCRIBE_PATH}`, {
    method: 'POST',
    headers,
    body: requestBody,
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    const details = errorBody ? `: ${errorBody}` : '';
    throw new Error(`Notifications subscribe failed with status ${response.status}${details}`);
  }
  if (!response.body) {
    throw new Error('Notifications subscribe response body is empty');
  }

  const reader = response.body.getReader();
  let buffer = new Uint8Array();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) buffer = concatBuffers(buffer, value);

    let offset = 0;
    while (true) {
      const envelope = tryReadEnvelope(buffer, offset);
      if (!envelope) break;
      offset = envelope.nextOffset;
      if (envelope.flags === 0x02) {
        parseEndStream(envelope.data);
        return;
      }
      if (envelope.flags !== 0x00) {
        throw new Error(`Unexpected response envelope flags: ${envelope.flags}`);
      }

      let payload: unknown;
      try {
        payload = JSON.parse(textDecoder.decode(envelope.data)) as unknown;
      } catch (error) {
        throw new Error('Failed to parse notifications response payload', { cause: error });
      }
      const parsed = parseNotificationEnvelope(payload);
      if (parsed) {
        yield parsed;
      }
    }

    if (offset > 0) {
      buffer = buffer.slice(offset);
    }
  }
}
