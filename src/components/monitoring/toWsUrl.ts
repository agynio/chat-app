import { getSocketBaseUrl } from '@/config';

function resolveSocketBase(): URL {
  const raw = getSocketBaseUrl();
  try {
    return new URL(raw, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  } catch {
    throw new Error('terminal: invalid socket base URL');
  }
}

export function toWsUrl(path: string): string {
  if (path.startsWith('ws://') || path.startsWith('wss://')) return path;

  const baseUrl = resolveSocketBase();
  baseUrl.protocol = baseUrl.protocol === 'https:' ? 'wss:' : baseUrl.protocol === 'http:' ? 'ws:' : baseUrl.protocol;

  const resolved = new URL(path, baseUrl);
  return resolved.toString();
}
