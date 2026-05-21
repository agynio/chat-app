type MessageTraceParams = {
  messageId: string;
  organizationId: string;
};

type RunTraceParams = {
  runId: string;
  organizationId: string;
};

function stripTrailingSlash(pathname: string): string {
  return pathname.replace(/\/+$/, '');
}

function buildTraceUrl(baseUrl: string, pathname: string, searchParams?: URLSearchParams): string {
  const url = new URL(baseUrl);
  const basePath = stripTrailingSlash(url.pathname);
  url.pathname = `${basePath}${pathname}`;
  url.search = searchParams?.toString() ?? '';
  return url.toString();
}

export function buildMessageTraceUrl(baseUrl: string, { messageId, organizationId }: MessageTraceParams): string {
  return buildTraceUrl(
    baseUrl,
    `/message/${encodeURIComponent(messageId)}`,
    new URLSearchParams({ orgId: organizationId }),
  );
}

export function buildRunTraceUrl(baseUrl: string, { organizationId, runId }: RunTraceParams): string {
  return buildTraceUrl(baseUrl, `/${encodeURIComponent(organizationId)}/runs/${encodeURIComponent(runId)}`);
}

export function resolveMessageTraceUrl(
  baseUrl: string | null,
  organizationId: string | undefined,
  messageId: string,
): string | null {
  if (!baseUrl || !organizationId) return null;
  return buildMessageTraceUrl(baseUrl, { messageId, organizationId });
}
