import { resolveMessageTraceUrl } from '@/utils/tracing';

type MessageTraceContext = {
  baseUrl: string | null;
  organizationId: string | undefined;
  messageId: string;
  isAgentMessage: boolean;
};

export function resolveChatMessageTraceUrl({
  baseUrl,
  organizationId,
  messageId,
  isAgentMessage,
}: MessageTraceContext): string | null {
  if (isAgentMessage) return null;
  return resolveMessageTraceUrl(baseUrl, organizationId, messageId);
}
