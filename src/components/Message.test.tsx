import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => <span>{content}</span>,
}));

describe('Message', () => {
  it('renders trace actions when provided', async () => {
    const { Message } = await import('./Message');
    const markup = renderToStaticMarkup(
      <Message
        role="user"
        content="Hello"
        traceUrl="https://trace.agyn.dev/message/msg-123?orgId=org-456"
      />,
    );

    expect(markup).toContain('message-actions-trigger');
    expect(markup).toContain('data-trace-url="https://trace.agyn.dev/message/msg-123?orgId=org-456"');
  });

  it('omits the trace action when not provided', async () => {
    const { Message } = await import('./Message');
    const markup = renderToStaticMarkup(<Message role="user" content="Hello" />);

    expect(markup).not.toContain('data-trace-url');
    expect(markup).not.toContain('message-actions-trigger');
  });
});
