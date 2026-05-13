import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mediaImageSpy = vi.fn();

vi.mock('./MediaImage', () => ({
  MediaImage: (props: { src: string }) => {
    mediaImageSpy(props);
    return null;
  },
}));

vi.mock('./MediaAudio', () => ({
  MediaAudio: () => null,
}));

vi.mock('./MediaVideo', () => ({
  MediaVideo: () => null,
}));

vi.mock('./MarkdownDiagram', () => ({
  MarkdownDiagram: ({ language, source }: { language: string; source: string }) => (
    <div data-testid={`markdown-${language}`}>{source}</div>
  ),
}));

describe('MarkdownContent', () => {
  beforeEach(() => {
    mediaImageSpy.mockClear();
  });

  it('passes agyn protocol urls to MediaImage', async () => {
    const { MarkdownContent } = await import('./MarkdownContent');
    const url = 'agyn://file/some-uuid';

    renderToStaticMarkup(<MarkdownContent content={`![test](${url})`} />);

    expect(mediaImageSpy).toHaveBeenCalledOnce();
    const [props] = mediaImageSpy.mock.calls[0] as [{ src?: string }];
    expect(props.src).toBe(url);
  });

  it('renders inline code with inline-safe classes', async () => {
    const { MarkdownContent } = await import('./MarkdownContent');

    const markup = renderToStaticMarkup(<MarkdownContent content={"before `test` after"} />);

    expect(markup).toContain('<code class="inline rounded');
    expect(markup).toContain('font-mono');
    expect(markup).toContain('text-[var(--agyn-purple)]');
    expect(markup).not.toContain('<code class="block whitespace-pre-wrap');
  });

  it('renders headings with explicit typography classes', async () => {
    const { MarkdownContent } = await import('./MarkdownContent');

    const markup = renderToStaticMarkup(<MarkdownContent content={"# Header"} />);

    expect(markup).toContain('<h1 class="mb-4 mt-6 text-3xl font-bold');
    expect(markup).toContain('Header</h1>');
  });

  it('renders mermaid code blocks as diagrams', async () => {
    const { MarkdownContent } = await import('./MarkdownContent');

    const markup = renderToStaticMarkup(<MarkdownContent content={"```mermaid\ngraph TD\nA-->B\n```"} />);

    expect(markup).toContain('data-testid="markdown-mermaid"');
    expect(markup).toContain('graph TD');
    expect(markup).not.toContain('<pre');
  });

});
