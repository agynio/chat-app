import { afterEach, describe, expect, it, vi } from 'vitest';

const loadProxyModule = async (mediaProxyUrl: string | null) => {
  vi.resetModules();
  vi.doMock('@/config', () => ({
    config: {
      mediaProxyUrl,
    },
  }));
  return import('./proxy-url');
};

afterEach(() => {
  vi.resetModules();
  vi.unmock('@/config');
});

describe('proxy-url', () => {
  it('builds proxy url with size for external urls', async () => {
    const { buildProxyUrl } = await loadProxyModule('https://media.agyn.dev');
    const result = buildProxyUrl('https://example.com/image.png', { size: 800 });
    expect(result).toBe('https://media.agyn.dev/proxy?url=https%3A%2F%2Fexample.com%2Fimage.png&size=800');
  });

  it('builds proxy url for agyn files without size', async () => {
    const { buildDownloadUrl } = await loadProxyModule('https://media.agyn.dev');
    const result = buildDownloadUrl('agyn://file/1234');
    expect(result).toBe('https://media.agyn.dev/proxy?url=agyn%3A%2F%2Ffile%2F1234');
  });

  it('returns null when media proxy is missing', async () => {
    const { buildProxyUrl } = await loadProxyModule(null);
    const result = buildProxyUrl('https://example.com/image.png', { size: 800 });
    expect(result).toBeNull();
  });

  it('parses agyn file ids', async () => {
    const { isAgynFileUrl, parseAgynFileId } = await loadProxyModule('https://media.agyn.dev');
    expect(isAgynFileUrl('agyn://file/550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(parseAgynFileId('agyn://file/550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000',
    );
    expect(isAgynFileUrl('https://example.com/file')).toBe(false);
    expect(parseAgynFileId('https://example.com/file')).toBeNull();
  });
});
