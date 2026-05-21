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

    const markup = renderToStaticMarkup(<MarkdownContent content={'before `test` after'} />);

    expect(markup).toContain('<code class="inline rounded');
    expect(markup).toContain('font-mono');
    expect(markup).toContain('text-[var(--agyn-purple)]');
    expect(markup).not.toContain('<code class="block whitespace-pre-wrap');
  });

  it('renders headings with explicit typography classes', async () => {
    const { MarkdownContent } = await import('./MarkdownContent');

    const markup = renderToStaticMarkup(<MarkdownContent content={'# Header'} />);

    expect(markup).toContain('<h1 class="mb-4 mt-6 text-3xl font-bold');
    expect(markup).toContain('Header</h1>');
  });

  it('keeps regular fenced code blocks in styled pre/code markup', async () => {
    const { MarkdownContent } = await import('./MarkdownContent');

    const markup = renderToStaticMarkup(
      <MarkdownContent content={'```ts\nconst value = 1;\n```'} />,
    );

    expect(markup).toContain('<pre class="my-4 w-full overflow-x-auto');
    expect(markup).toContain('<code class="block whitespace-pre-wrap');
    expect(markup).toContain('language-ts');
    expect(markup).toContain('const value = 1;');
    expect(markup).not.toContain('data-testid="markdown-ts"');
  });

  it('renders mermaid fenced code blocks as diagrams', async () => {
    const { MarkdownContent } = await import('./MarkdownContent');

    const markup = renderToStaticMarkup(
      <MarkdownContent content={'```mermaid\ngraph TD\nA --> B\n```'} />,
    );

    expect(markup).toContain('data-testid="markdown-mermaid"');
    expect(markup).toContain('graph TD');
    expect(markup).not.toContain('language-mermaid');
  });

  it('renders vega-lite fenced code blocks as diagrams', async () => {
    const { MarkdownContent } = await import('./MarkdownContent');

    const spec = '{"data":{"values":[{"x":1}]},"mark":"bar"}';
    const markup = renderToStaticMarkup(
      <MarkdownContent content={`\`\`\`vega-lite\n${spec}\n\`\`\``} />,
    );

    expect(markup).toContain('data-testid="markdown-vega-lite"');
    expect(markup).toContain('&quot;mark&quot;:&quot;bar&quot;');
    expect(markup).not.toContain('language-vega-lite');
  });
});
