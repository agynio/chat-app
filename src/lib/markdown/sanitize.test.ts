import { describe, expect, it } from 'vitest';
import { sanitizeDiagramSvg, sanitizeMarkdownHtml } from './sanitize';

describe('sanitizeDiagramSvg', () => {
  it('keeps safe SVG styles and strips unsafe CSS', () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg">
        <style>
          .label { text-anchor: middle; }
          @import url("https://evil.com/style.css");
          @font-face { font-family: "Evil"; src: url("https://evil.com/font.woff"); }
          .safe { fill: url(#gradient); }
          .unsafe { fill: url("https://evil.com/image.png"); }
        </style>
        <defs>
          <linearGradient id="gradient"></linearGradient>
        </defs>
        <rect style="fill: url(#gradient); stroke: url(https://evil.com/stroke.png);"></rect>
        <text class="label">Hello</text>
      </svg>
    `;

    const sanitized = sanitizeDiagramSvg(svg);
    expect(sanitized).not.toBeNull();
    if (!sanitized) {
      throw new Error('sanitizeDiagramSvg returned null');
    }

    expect(sanitized).toContain('<style>');
    expect(sanitized).toContain('text-anchor: middle');
    expect(sanitized).toContain('url(#gradient)');
    expect(sanitized).not.toContain('@import');
    expect(sanitized).not.toContain('@font-face');
    expect(sanitized).not.toContain('https://evil.com');
  });
});

describe('sanitizeMarkdownHtml', () => {
  it('strips style tags from user-provided HTML', () => {
    const html = '<p>Hello</p><style>p{color:red}</style>';
    const sanitized = sanitizeMarkdownHtml(html);
    expect(sanitized).not.toBeNull();
    if (!sanitized) {
      throw new Error('sanitizeMarkdownHtml returned null');
    }
    expect(sanitized).toContain('<p>Hello</p>');
    expect(sanitized).not.toContain('<style>');
  });
});
