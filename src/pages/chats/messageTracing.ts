import { buildRunTraceUrl, resolveMessageTraceUrl } from '@/utils/tracing';

export const TRACE_RUN_CACHE_KEY = 'ui.tracing.message-run-map';
const TRACE_RUN_CACHE_VERSION = 1;

type MessageTraceContext = {
  baseUrl: string | null;
  organizationId: string | undefined;
  messageId: string;
  isAgentMessage: boolean;
};

type TraceRunCache = {
  version?: number;
  map?: Record<string, string>;
};

function cacheKey(organizationId: string, messageId: string): string {
  return `${organizationId}:${messageId}`;
}

function readCache(): Record<string, string> {
  if (typeof sessionStorage === 'undefined') return {};
  const raw = sessionStorage.getItem(TRACE_RUN_CACHE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as TraceRunCache | null;
    if (parsed?.version !== TRACE_RUN_CACHE_VERSION || !parsed.map || typeof parsed.map !== 'object') {
      return {};
    }
    return parsed.map;
  } catch (_error) {
    return {};
  }
}

export function rememberChatMessageRunId(
  organizationId: string | undefined,
  messageId: string,
  runId: string | null,
): void {
  if (!organizationId || !runId || typeof sessionStorage === 'undefined') return;
  const map = { ...readCache(), [cacheKey(organizationId, messageId)]: runId };
  sessionStorage.setItem(TRACE_RUN_CACHE_KEY, JSON.stringify({ version: TRACE_RUN_CACHE_VERSION, map }));
}

export function resolveChatMessageTraceUrl({
  baseUrl,
  organizationId,
  messageId,
  isAgentMessage,
}: MessageTraceContext): string | null {
  if (isAgentMessage || !baseUrl || !organizationId) return null;

  const runId = readCache()[cacheKey(organizationId, messageId)];
  if (runId) {
    return buildRunTraceUrl(baseUrl, { organizationId, runId });
  }

  return resolveMessageTraceUrl(baseUrl, organizationId, messageId);
}
