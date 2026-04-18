type MessageTraceParams = {
  messageId: string;
  organizationId: string;
};

function stripTrailingSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '');
}

export function buildMessageTraceUrl(baseUrl: string, { messageId, organizationId }: MessageTraceParams): string {
  const url = new URL(baseUrl);
  const basePath = stripTrailingSlash(url.pathname);
  url.pathname = `${basePath}/message/${encodeURIComponent(messageId)}`;
  url.search = new URLSearchParams({ orgId: organizationId }).toString();
  return url.toString();
}

export function resolveMessageTraceUrl(
  baseUrl: string | null,
  organizationId: string | undefined,
  messageId: string,
): string | null {
  if (!baseUrl || !organizationId) return null;
  return buildMessageTraceUrl(baseUrl, { messageId, organizationId });
}
