import { describe, expect, it } from 'vitest';
import { buildMessageTraceUrl, resolveMessageTraceUrl } from './tracing';

describe('buildMessageTraceUrl', () => {
  it('builds a message trace url with org and message', () => {
    const url = buildMessageTraceUrl('https://trace.agyn.dev', {
      organizationId: 'org-123',
      messageId: 'msg-456',
    });

    expect(url).toBe('https://trace.agyn.dev/message/msg-456?orgId=org-123');
  });

  it('preserves base paths when building', () => {
    const url = buildMessageTraceUrl('https://trace.agyn.dev/app/', {
      organizationId: 'org-123',
      messageId: 'msg-456',
    });

    expect(url).toBe('https://trace.agyn.dev/app/message/msg-456?orgId=org-123');
  });
});

describe('resolveMessageTraceUrl', () => {
  it('returns null when base url is missing', () => {
    expect(resolveMessageTraceUrl(null, 'org-123', 'msg-456')).toBeNull();
  });
});
