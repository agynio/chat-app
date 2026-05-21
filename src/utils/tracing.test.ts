import { describe, expect, it } from 'vitest';
import { buildMessageTraceUrl, buildRunTraceUrl, resolveMessageTraceUrl } from './tracing';

describe('buildMessageTraceUrl', () => {
  it('builds a message trace url with org and message', () => {
    const url = buildMessageTraceUrl('https://tracing.agyn.dev', {
      organizationId: 'org-123',
      messageId: 'msg-456',
    });

    expect(url).toBe('https://tracing.agyn.dev/message/msg-456?orgId=org-123');
  });

  it('preserves base paths when building', () => {
    const url = buildMessageTraceUrl('https://tracing.agyn.dev/app/', {
      organizationId: 'org-123',
      messageId: 'msg-456',
    });

    expect(url).toBe('https://tracing.agyn.dev/app/message/msg-456?orgId=org-123');
  });
});

describe('buildRunTraceUrl', () => {
  it('builds a direct run trace url', () => {
    const url = buildRunTraceUrl('https://tracing.agyn.dev', {
      organizationId: 'org-123',
      runId: '00112233445566778899aabbccddeeff',
    });

    expect(url).toBe('https://tracing.agyn.dev/org-123/runs/00112233445566778899aabbccddeeff');
  });

  it('preserves base paths when building', () => {
    const url = buildRunTraceUrl('https://tracing.agyn.dev/app/', {
      organizationId: 'org-123',
      runId: '00112233445566778899aabbccddeeff',
    });

    expect(url).toBe('https://tracing.agyn.dev/app/org-123/runs/00112233445566778899aabbccddeeff');
  });
});

describe('resolveMessageTraceUrl', () => {
  it('returns null when base url is missing', () => {
    expect(resolveMessageTraceUrl(null, 'org-123', 'msg-456')).toBeNull();
  });

  it('returns null when org id is missing', () => {
    expect(resolveMessageTraceUrl('https://tracing.agyn.dev', undefined, 'msg-456')).toBeNull();
  });

  it('returns a trace url when base and org id are provided', () => {
    const url = resolveMessageTraceUrl('https://tracing.agyn.dev', 'org-123', 'msg-456');

    expect(url).toBe('https://tracing.agyn.dev/message/msg-456?orgId=org-123');
  });
});
