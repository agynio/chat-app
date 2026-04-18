import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./MarkdownContent', () => ({
  MarkdownContent: ({ content }: { content: string }) => <span>{content}</span>,
}));

describe('Message', () => {
  it('renders a trace link when provided', async () => {
    const { Message } = await import('./Message');
    const markup = renderToStaticMarkup(
      <Message
        role="user"
        content="Hello"
        traceUrl="https://trace.agyn.dev/message/msg-123?orgId=org-456"
      />,
    );

    expect(markup).toContain('View trace');
    expect(markup).toContain('href="https://trace.agyn.dev/message/msg-123?orgId=org-456"');
    expect(markup).toContain('data-testid="message-trace-link"');
  });

  it('omits the trace link when not provided', async () => {
    const { Message } = await import('./Message');
    const markup = renderToStaticMarkup(<Message role="user" content="Hello" />);

    expect(markup).not.toContain('View trace');
    expect(markup).not.toContain('message-trace-link');
  });
});
