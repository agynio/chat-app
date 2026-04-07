import { config } from '@/config';
import { getAccessToken, userManager } from '@/auth';

const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type SetTokenMessage = {
  type: 'SET_TOKEN';
  token: string;
  mediaProxyOrigin: string;
};

type ClearTokenMessage = {
  type: 'CLEAR_TOKEN';
};

type MediaProxyMessage = SetTokenMessage | ClearTokenMessage;

const resolveMediaProxyOrigin = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch (_error) {
    return null;
  }
};

const postMessageToWorker = (
  registration: ServiceWorkerRegistration,
  message: MediaProxyMessage,
): void => {
  const controller = navigator.serviceWorker.controller;
  if (controller) {
    controller.postMessage(message);
    return;
  }

  const active = registration.active;
  if (active) {
    active.postMessage(message);
  }
};

const sendTokenUpdate = async (
  registration: ServiceWorkerRegistration,
  mediaProxyOrigin: string,
): Promise<void> => {
  const token = await getAccessToken();
  if (!token) {
    postMessageToWorker(registration, { type: 'CLEAR_TOKEN' });
    return;
  }

  postMessageToWorker(registration, {
    type: 'SET_TOKEN',
    token,
    mediaProxyOrigin,
  });
};

export async function registerMediaServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!config.mediaProxyUrl) return;

  const mediaProxyOrigin = resolveMediaProxyOrigin(config.mediaProxyUrl);
  if (!mediaProxyOrigin) {
    console.warn('[media] invalid MEDIA_PROXY_URL; service worker disabled');
    return;
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
  } catch (error) {
    console.warn('[media] failed to register service worker', error);
    return;
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    void sendTokenUpdate(registration, mediaProxyOrigin);
  });

  void sendTokenUpdate(registration, mediaProxyOrigin);

  if (userManager) {
    userManager.events.addUserLoaded(() => {
      void sendTokenUpdate(registration, mediaProxyOrigin);
    });
    userManager.events.addUserSignedOut(() => {
      postMessageToWorker(registration, { type: 'CLEAR_TOKEN' });
    });
  }

  window.setInterval(() => {
    void sendTokenUpdate(registration, mediaProxyOrigin);
  }, TOKEN_REFRESH_INTERVAL_MS);
}
