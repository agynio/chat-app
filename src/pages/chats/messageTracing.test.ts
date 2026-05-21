import { afterEach, describe, expect, it, vi } from 'vitest';
import { TRACE_RUN_CACHE_KEY, rememberChatMessageRunId, resolveChatMessageTraceUrl } from './messageTracing';

const storage = new Map<string, string>();

vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  clear: () => storage.clear(),
});

describe('resolveChatMessageTraceUrl', () => {
  afterEach(() => {
    storage.clear();
  });

  it('returns null for agent messages', () => {
    const url = resolveChatMessageTraceUrl({
      baseUrl: 'https://tracing.agyn.dev',
      organizationId: 'org-123',
      messageId: 'msg-456',
      isAgentMessage: true,
    });

    expect(url).toBeNull();
  });

  it('returns message trace url for non-agent messages without cached run ids', () => {
    const url = resolveChatMessageTraceUrl({
      baseUrl: 'https://tracing.agyn.dev',
      organizationId: 'org-123',
      messageId: 'msg-456',
      isAgentMessage: false,
    });

    expect(url).toBe('https://tracing.agyn.dev/message/msg-456?orgId=org-123');
  });

  it('returns direct run trace url for non-agent messages with cached run ids', () => {
    storage.set(TRACE_RUN_CACHE_KEY, JSON.stringify({ version: 1, map: {} }));
    rememberChatMessageRunId('org-123', 'msg-456', '00112233445566778899aabbccddeeff');

    const url = resolveChatMessageTraceUrl({
      baseUrl: 'https://tracing.agyn.dev',
      organizationId: 'org-123',
      messageId: 'msg-456',
      isAgentMessage: false,
    });

    expect(url).toBe('https://tracing.agyn.dev/org-123/runs/00112233445566778899aabbccddeeff');
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
