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
});
