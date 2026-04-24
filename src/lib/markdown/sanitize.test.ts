import rehypeParse from 'rehype-parse';
import { unified } from 'unified';
import { describe, expect, it } from 'vitest';
import type { Element, Root } from 'hast';
import { sanitizeDiagramSvg, sanitizeMarkdownHtml } from './sanitize';

function parseRoot(markup: string): Root {
  return unified().use(rehypeParse, { fragment: true }).parse(markup) as Root;
}

function elementChildren(node: Root | Element): Element[] {
  return (node.children ?? []).filter((child): child is Element => child.type === 'element');
}

describe('sanitizeDiagramSvg', () => {
  it('moves top-level style into the svg root', () => {
    const input =
      '<style>.node{fill:#fff;}</style><svg viewBox="0 0 10 10"><rect width="10" height="10" /></svg>';
    const sanitized = sanitizeDiagramSvg(input);

    expect(sanitized).not.toBeNull();
    if (!sanitized) return;

    expect(sanitized).toContain('fill:#fff');
    const root = parseRoot(sanitized);
    const rootElements = elementChildren(root);
    expect(rootElements).toHaveLength(1);
    expect(rootElements[0]?.tagName).toBe('svg');

    const svgChildren = elementChildren(rootElements[0]);
    expect(svgChildren.some((child) => child.tagName === 'style')).toBe(true);
  });

  it('preserves filter tags, data attributes, and font style', () => {
    const input = [
      '<style>.node{filter:url(#shadow);}</style>',
      '<svg viewBox="0 0 10 10">',
      '  <defs>',
      '    <filter id="shadow" x="0" y="0" width="1" height="1">',
      '      <feDropShadow dx="1" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.5" />',
      '    </filter>',
      '  </defs>',
      '  <g data-id="node" data-look="handDrawn">',
      '    <path d="M0 0" data-edge="1" data-et="edge" data-id="edge" data-points="0,0 1,1" />',
      '  </g>',
      '  <text font-style="italic">Hello</text>',
      '</svg>',
    ].join('');
    const sanitized = sanitizeDiagramSvg(input);

    expect(sanitized).not.toBeNull();
    if (!sanitized) return;
    expect(sanitized).toContain('<filter');
    expect(sanitized).toContain('<feDropShadow');
    expect(sanitized).toContain('data-edge');
    expect(sanitized).toContain('font-style="italic"');
  });

  it('fails closed on unsafe css', () => {
    const input = [
      '<style>',
      '@import url("https://evil.test");',
      '@font-face { font-family: "Evil"; src: url("https://evil.test/font.woff"); }',
      '</style>',
      '<svg></svg>',
    ].join('');
    expect(sanitizeDiagramSvg(input)).toBeNull();
  });

  it('rejects external urls in style attributes', () => {
    const input = '<svg><rect style="fill:url(https://evil.test)" /></svg>';
    expect(sanitizeDiagramSvg(input)).toBeNull();
  });

  it('rejects unsupported tags like foreignObject', () => {
    const input = '<svg><foreignObject><div>Bad</div></foreignObject></svg>';
    expect(sanitizeDiagramSvg(input)).toBeNull();
  });

  it('rejects external urls in presentation attributes', () => {
    const input = '<svg><path filter="url (https://evil.test)" /></svg>';
    expect(sanitizeDiagramSvg(input)).toBeNull();
  });
});

describe('sanitizeMarkdownHtml', () => {
  it('strips style tags from user-provided HTML', () => {
    const html = '<p>Hello</p><style>p{color:red}</style>';
    const sanitized = sanitizeMarkdownHtml(html);
    expect(sanitized).not.toBeNull();
    if (!sanitized) return;
    expect(sanitized).toContain('<p>Hello</p>');
    expect(sanitized).not.toContain('<style>');
  });
});
