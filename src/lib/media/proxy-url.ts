import { config } from '@/config';

const AGYN_FILE_PROTOCOL = 'agyn:';
const AGYN_FILE_HOST = 'file';

export const INLINE_IMAGE_MAX_SIZE = 800;

type BuildProxyOptions = {
  size?: number | null;
};

const normalizeInput = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed;
};

const resolveMediaProxyBase = (): string | null => {
  const base = config.mediaProxyUrl;
  if (typeof base !== 'string') return null;
  const trimmed = base.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '');
};

const normalizeSize = (size?: number | null): string | null => {
  if (typeof size !== 'number' || !Number.isFinite(size) || size <= 0) return null;
  return Math.round(size).toString();
};

export function buildProxyUrl(originalUrl: string, options: BuildProxyOptions = {}): string | null {
  const base = resolveMediaProxyBase();
  const normalizedOriginal = normalizeInput(originalUrl);
  if (!base || !normalizedOriginal) return null;

  const proxyBase = `${base}/proxy`;
  const url = new URL(proxyBase);
  url.searchParams.set('url', normalizedOriginal);

  const size = normalizeSize(options.size);
  if (size) {
    url.searchParams.set('size', size);
  }

  return url.toString();
}

export function buildDownloadUrl(originalUrl: string): string | null {
  return buildProxyUrl(originalUrl);
}

export function parseAgynFileId(value: string): string | null {
  const normalized = normalizeInput(value);
  if (!normalized) return null;

  let url: URL;
  try {
    url = new URL(normalized);
  } catch (_error) {
    return null;
  }

  if (url.protocol !== AGYN_FILE_PROTOCOL) return null;
  if (url.hostname !== AGYN_FILE_HOST) return null;

  const path = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  return path ? path : null;
}

export function isAgynFileUrl(value: string): boolean {
  return parseAgynFileId(value) !== null;
}
