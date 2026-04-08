type SetTokenMessage = {
  type: 'SET_TOKEN';
  token: string;
  mediaProxyOrigin: string;
};

type ClearTokenMessage = {
  type: 'CLEAR_TOKEN';
};

type MediaProxyMessage = SetTokenMessage | ClearTokenMessage;

// Boundary: validate and normalize incoming messages.
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object';
};

const parseSetTokenMessage = (value: Record<string, unknown>): SetTokenMessage | null => {
  if (value.type !== 'SET_TOKEN') return null;

  const token = typeof value.token === 'string' ? value.token.trim() : '';
  const origin = typeof value.mediaProxyOrigin === 'string' ? value.mediaProxyOrigin.trim() : '';
  if (!token || !origin) return null;

  let normalizedOrigin = '';
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch (_error) {
    return null;
  }

  return { type: 'SET_TOKEN', token, mediaProxyOrigin: normalizedOrigin };
};

const parseClearTokenMessage = (value: Record<string, unknown>): ClearTokenMessage | null => {
  if (value.type !== 'CLEAR_TOKEN') return null;
  return { type: 'CLEAR_TOKEN' };
};

const parseMediaProxyMessage = (value: unknown): MediaProxyMessage | null => {
  if (!isRecord(value)) return null;
  return parseSetTokenMessage(value) ?? parseClearTokenMessage(value);
};

// Internal: strict logic based on validated inputs.
let accessToken: string | null = null;
let mediaProxyOrigin: string | null = null;

const handleMessage = (message: MediaProxyMessage): void => {
  if (message.type === 'CLEAR_TOKEN') {
    accessToken = null;
    mediaProxyOrigin = null;
    return;
  }

  accessToken = message.token;
  mediaProxyOrigin = message.mediaProxyOrigin;
};

const shouldProxyRequest = (request: Request): boolean => {
  if (!mediaProxyOrigin) return false;
  try {
    return new URL(request.url).origin === mediaProxyOrigin;
  } catch (_error) {
    return false;
  }
};

const buildAuthorizedRequest = (request: Request, token: string): Request => {
  const headers = new Headers(request.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return new Request(request, {
    headers,
    mode: 'cors',
    credentials: request.credentials,
  });
};

const buildUnauthorizedResponse = () =>
  new Response('Unauthorized', {
    status: 401,
    statusText: 'Unauthorized',
    headers: { 'Content-Type': 'text/plain' },
  });

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const message = parseMediaProxyMessage(event.data);
  if (message) {
    handleMessage(message);
  }
});

self.addEventListener('fetch', (event) => {
  if (!shouldProxyRequest(event.request)) return;

  if (!accessToken) {
    event.respondWith(buildUnauthorizedResponse());
    return;
  }

  const authorizedRequest = buildAuthorizedRequest(event.request, accessToken);
  event.respondWith(fetch(authorizedRequest));
});
