import { describe, expect, it } from 'vitest';
import { resolveChatMessageTraceUrl } from './messageTracing';

describe('resolveChatMessageTraceUrl', () => {
  it('returns null for agent messages', () => {
    const url = resolveChatMessageTraceUrl({
      baseUrl: 'https://tracing.agyn.dev',
      organizationId: 'org-123',
      messageId: 'msg-456',
      isAgentMessage: true,
    });

    expect(url).toBeNull();
  });

  it('returns trace url for non-agent messages', () => {
    const url = resolveChatMessageTraceUrl({
      baseUrl: 'https://tracing.agyn.dev',
      organizationId: 'org-123',
      messageId: 'msg-456',
      isAgentMessage: false,
    });

    expect(url).toBe('https://tracing.agyn.dev/message/msg-456?orgId=org-123');
  });

  it('returns null when trace config is missing', () => {
    const url = resolveChatMessageTraceUrl({
      baseUrl: null,
      organizationId: undefined,
      messageId: 'msg-456',
      isAgentMessage: false,
    });

    expect(url).toBeNull();
  });
});
