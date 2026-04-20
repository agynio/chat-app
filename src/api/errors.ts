import type { ApiError } from '@/api/http';

type ConnectErrorPayload = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
};

type ConnectErrorDetails = {
  code?: string;
  message?: string;
};

export function resolveErrorMessage(error: unknown, fallback: string): string {
  const maybeApiError = error as ApiError;
  const payload = maybeApiError?.response?.data as { error?: unknown; message?: unknown } | undefined;
  const payloadMessage = payload?.error ?? payload?.message;
  if (typeof payloadMessage === 'string' && payloadMessage.trim()) return payloadMessage;
  if (maybeApiError?.message && typeof maybeApiError.message === 'string') return maybeApiError.message;
  if (error instanceof Error && typeof error.message === 'string') return error.message;
  return fallback;
}

const normalizeConnectCode = (code: string): string => {
  return code
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
};

const resolveConnectPayload = (data: unknown): ConnectErrorPayload | null => {
  if (!data) return null;
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as ConnectErrorPayload;
      }
    } catch {
      return null;
    }
    return null;
  }

  if (typeof data === 'object') return data as ConnectErrorPayload;
  return null;
};

export function resolveConnectErrorDetails(error: unknown): ConnectErrorDetails | null {
  const maybeApiError = error as ApiError;
  const payload = resolveConnectPayload(maybeApiError?.response?.data);
  if (!payload) return null;

  const nestedPayload = typeof payload.error === 'object' && payload.error !== null
    ? (payload.error as ConnectErrorPayload)
    : payload;

  const code = typeof nestedPayload.code === 'string' ? nestedPayload.code : undefined;
  const message = typeof nestedPayload.message === 'string'
    ? nestedPayload.message
    : typeof nestedPayload.error === 'string'
      ? nestedPayload.error
      : undefined;

  if (!code && !message) return null;
  return { code, message };
}

export function isThreadDegradedError(error: unknown): boolean {
  const details = resolveConnectErrorDetails(error);
  if (!details?.code || details.message !== 'thread is degraded') return false;
  return normalizeConnectCode(details.code) === 'failed_precondition';
}
