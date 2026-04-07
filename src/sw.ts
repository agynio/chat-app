type SetTokenMessage = {
  type: 'SET_TOKEN';
  token: string;
  mediaProxyOrigin: string;
};

type ClearTokenMessage = {
  type: 'CLEAR_TOKEN';
};

type MediaProxyMessage = SetTokenMessage | ClearTokenMessage;

let accessToken: string | null = null;
let mediaProxyOrigin: string | null = null;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object';
};

const parseSetTokenMessage = (value: unknown): SetTokenMessage | null => {
  if (!isRecord(value)) return null;
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

const isClearTokenMessage = (value: unknown): value is ClearTokenMessage => {
  return isRecord(value) && value.type === 'CLEAR_TOKEN';
};

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

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  const setMessage = parseSetTokenMessage(event.data);
  if (setMessage) {
    handleMessage(setMessage);
    return;
  }
  if (isClearTokenMessage(event.data)) {
    handleMessage({ type: 'CLEAR_TOKEN' });
  }
});

self.addEventListener('fetch', (event) => {
  if (!shouldProxyRequest(event.request)) return;

  if (!accessToken) {
    event.respondWith(fetch(event.request));
    return;
  }

  const authorizedRequest = buildAuthorizedRequest(event.request, accessToken);
  event.respondWith(fetch(authorizedRequest));
});
