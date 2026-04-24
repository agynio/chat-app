import type { Element, Properties, Root, Text } from 'hast';
import type { Schema } from 'hast-util-sanitize';
import rehypeParse from 'rehype-parse';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

const htmlTagNames: Schema['tagNames'] = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'ol',
  'picture',
  'p',
  'pre',
  'strong',
  'u',
  'ul',
  'video',
  'audio',
  'source',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
];

const svgTagNames: Schema['tagNames'] = [
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'clipPath',
  'mask',
  'pattern',
  'marker',
  'linearGradient',
  'radialGradient',
  'stop',
  'symbol',
  'use',
  'title',
  'desc',
];

const diagramTagNames: Schema['tagNames'] = [
  ...svgTagNames,
  'style',
  'filter',
  'feDropShadow',
];

const diagramTagNameSet = new Set(diagramTagNames);

const allowedProtocols: string[] = ['http', 'https', 'mailto'];

export const markdownSanitizeSchema: Schema = {
  tagNames: [...htmlTagNames, ...svgTagNames],
  attributes: {
    a: [
      'href',
      ['target', '_blank', '_self'],
      ['rel', 'noopener', 'noreferrer', 'nofollow'],
    ],
    code: [
      ['className', /^language-[\w-]+$/],
    ],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    ol: [
      ['start', /^-?\d+$/],
      ['type', '1', 'a', 'A', 'i', 'I'],
      'reversed',
    ],
    li: [
      ['value', /^-?\d+$/],
    ],
    video: ['src', 'controls', 'preload', 'width', 'height', 'poster'],
    audio: ['src', 'controls', 'preload'],
    source: ['src', 'type'],
    th: ['align'],
    td: ['align'],
    svg: [
      'className',
      'id',
      'role',
      'aria-label',
      'aria-hidden',
      'focusable',
      'width',
      'height',
      'viewBox',
      'preserveAspectRatio',
      'xmlns',
      'xmlnsXLink',
      'xmlnsXlink',
      'style',
    ],
    g: [
      'className',
      'id',
      'transform',
      'fill',
      'fillOpacity',
      'stroke',
      'strokeWidth',
      'strokeDasharray',
      'strokeLinecap',
      'strokeLinejoin',
      'strokeMiterlimit',
      'strokeOpacity',
      'opacity',
      'style',
      'clipPath',
    ],
    path: [
      'className',
      'id',
      'd',
      'fill',
      'fillOpacity',
      'stroke',
      'strokeWidth',
      'strokeDasharray',
      'strokeLinecap',
      'strokeLinejoin',
      'strokeMiterlimit',
      'strokeOpacity',
      'opacity',
      'style',
      'markerEnd',
      'markerStart',
      'markerMid',
      'transform',
    ],
    rect: [
      'className',
      'id',
      'x',
      'y',
      'width',
      'height',
      'rx',
      'ry',
      'fill',
      'fillOpacity',
      'stroke',
      'strokeWidth',
      'strokeOpacity',
      'opacity',
      'style',
      'transform',
    ],
    circle: [
      'className',
      'id',
      'cx',
      'cy',
      'r',
      'fill',
      'fillOpacity',
      'stroke',
      'strokeWidth',
      'strokeOpacity',
      'opacity',
      'style',
      'transform',
    ],
    ellipse: [
      'className',
      'id',
      'cx',
      'cy',
      'rx',
      'ry',
      'fill',
      'fillOpacity',
      'stroke',
      'strokeWidth',
      'strokeOpacity',
      'opacity',
      'style',
      'transform',
    ],
    line: [
      'className',
      'id',
      'x1',
      'y1',
      'x2',
      'y2',
      'stroke',
      'strokeWidth',
      'strokeDasharray',
      'strokeOpacity',
      'opacity',
      'style',
      'transform',
    ],
    polyline: [
      'className',
      'id',
      'points',
      'fill',
      'fillOpacity',
      'stroke',
      'strokeWidth',
      'strokeDasharray',
      'strokeOpacity',
      'opacity',
      'style',
      'transform',
    ],
    polygon: [
      'className',
      'id',
      'points',
      'fill',
      'fillOpacity',
      'stroke',
      'strokeWidth',
      'strokeDasharray',
      'strokeOpacity',
      'opacity',
      'style',
      'transform',
    ],
    text: [
      'className',
      'id',
      'x',
      'y',
      'dx',
      'dy',
      'textAnchor',
      'dominantBaseline',
      'alignmentBaseline',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fill',
      'fillOpacity',
      'opacity',
      'style',
      'transform',
    ],
    tspan: [
      'className',
      'id',
      'x',
      'y',
      'dx',
      'dy',
      'textAnchor',
      'dominantBaseline',
      'alignmentBaseline',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fill',
      'fillOpacity',
      'opacity',
      'style',
      'transform',
    ],
    defs: ['id'],
    clipPath: ['id', 'clipPathUnits'],
    mask: ['id', 'maskUnits', 'maskContentUnits'],
    pattern: ['id', 'x', 'y', 'width', 'height', 'patternUnits', 'patternContentUnits'],
    marker: ['id', 'markerWidth', 'markerHeight', 'refX', 'refY', 'orient', 'markerUnits', 'viewBox'],
    linearGradient: ['id', 'x1', 'y1', 'x2', 'y2', 'gradientUnits', 'gradientTransform'],
    radialGradient: ['id', 'cx', 'cy', 'r', 'fx', 'fy', 'gradientUnits', 'gradientTransform'],
    stop: ['offset', 'stopColor', 'stopOpacity'],
    symbol: ['id', 'viewBox', 'preserveAspectRatio'],
    use: ['xLinkHref', 'xlinkHref', 'x', 'y', 'width', 'height'],
    title: ['id'],
    desc: ['id'],
  },
  protocols: {
    href: [...allowedProtocols],
    src: ['http', 'https', 'agyn'],
    xLinkHref: ['#'],
    xlinkHref: ['#'],
  },
};

const diagramBaseAttributes: NonNullable<Schema['attributes']> = markdownSanitizeSchema.attributes ?? {};
const diagramSanitizeSchema: Schema = {
  tagNames: diagramTagNames,
  attributes: {
    ...diagramBaseAttributes,
    svg: [...(diagramBaseAttributes.svg ?? []), 'ariaRoleDescription', 'data*'],
    g: [...(diagramBaseAttributes.g ?? []), 'data*', 'filter'],
    path: [...(diagramBaseAttributes.path ?? []), 'data*', 'filter'],
    rect: [...(diagramBaseAttributes.rect ?? []), 'data*', 'filter'],
    circle: [...(diagramBaseAttributes.circle ?? []), 'data*', 'filter'],
    ellipse: [...(diagramBaseAttributes.ellipse ?? []), 'data*', 'filter'],
    line: [...(diagramBaseAttributes.line ?? []), 'data*', 'filter'],
    polyline: [...(diagramBaseAttributes.polyline ?? []), 'data*', 'filter'],
    polygon: [...(diagramBaseAttributes.polygon ?? []), 'data*', 'filter'],
    text: [...(diagramBaseAttributes.text ?? []), 'data*', 'fontStyle', 'filter'],
    tspan: [...(diagramBaseAttributes.tspan ?? []), 'data*', 'fontStyle', 'filter'],
    filter: [
      'id',
      'x',
      'y',
      'width',
      'height',
      'filterUnits',
      'primitiveUnits',
      'colorInterpolationFilters',
    ],
    feDropShadow: ['dx', 'dy', 'stdDeviation', 'floodColor', 'floodOpacity', 'in', 'result'],
    style: ['type', 'media'],
  },
  protocols: markdownSanitizeSchema.protocols,
};

const cssCommentPattern = /\/\*[\s\S]*?\*\//g;
const cssUrlPattern = /url\s*\(([^)]+)\)/gi;
const cssUnsafeAtRulePattern = /@import|@font-face/i;
const cssLocalUrlPattern = /^#[\w:.-]+$/;

function stripCssComments(css: string): string {
  return css.replace(cssCommentPattern, '');
}

function collectCssUrlMatches(value: string): RegExpMatchArray[] {
  cssUrlPattern.lastIndex = 0;
  return [...value.matchAll(cssUrlPattern)];
}

function isSafeLocalUrlReference(value: string): boolean {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  return cssLocalUrlPattern.test(trimmed);
}

function isSafeSvgCss(css: string): boolean {
  if (!css) return true;
  if (css.includes('\\')) return false;
  const normalized = stripCssComments(css).toLowerCase();
  if (cssUnsafeAtRulePattern.test(normalized)) return false;
  const matches = collectCssUrlMatches(normalized);
  if (matches.length === 0) return true;
  return matches.every((match) => isSafeLocalUrlReference(match[1] ?? ''));
}

function assertSafeSvgCss(css: string): void {
  if (!isSafeSvgCss(css)) {
    throw new Error('Unsafe diagram CSS');
  }
}

function assertSafePresentationAttributes(properties: Properties | undefined): void {
  if (!properties) return;
  const styleValue = properties.style;
  if (typeof styleValue === 'string') {
    assertSafeSvgCss(styleValue);
  }

  for (const [name, value] of Object.entries(properties)) {
    if (name === 'style') continue;
    if (typeof value !== 'string') continue;
    const normalized = value.toLowerCase();
    if (value.includes('\\')) {
      throw new Error('Unsafe diagram URL');
    }
    const matches = collectCssUrlMatches(normalized);
    if (matches.length === 0) continue;
    for (const match of matches) {
      if (!isSafeLocalUrlReference(match[1] ?? '')) {
        throw new Error('Unsafe diagram URL');
      }
    }
  }
}

function collectStyleText(node: Element): string {
  return (node.children ?? [])
    .filter((child): child is Text => child.type === 'text')
    .map((child) => (typeof child.value === 'string' ? child.value : ''))
    .join('');
}

function isElement(node: unknown): node is Element {
  return Boolean(node) && typeof node === 'object' && (node as Element).type === 'element';
}

function isStyleElement(node: Element): boolean {
  return node.tagName === 'style';
}

function ensureDiagramTagNames(tree: Root): void {
  const visit = (node: Root | Element) => {
    for (const child of node.children ?? []) {
      if (!isElement(child)) continue;
      if (!diagramTagNameSet.has(child.tagName)) {
        throw new Error('Unsupported diagram markup');
      }
      visit(child);
    }
  };

  visit(tree);
}

function rehypeDiagramTagValidator() {
  return (tree: Root) => {
    ensureDiagramTagNames(tree);
  };
}

function findFirstSvg(tree: Root): Element | null {
  let svg: Element | null = null;

  const visit = (node: Root | Element) => {
    if (svg) return;
    for (const child of node.children ?? []) {
      if (!isElement(child)) continue;
      if (child.tagName === 'svg') {
        svg = child;
        return;
      }
      visit(child);
      if (svg) return;
    }
  };

  visit(tree);
  return svg;
}

function ensureSafeDiagramTree(tree: Root): void {
  const visit = (node: Root | Element) => {
    for (const child of node.children ?? []) {
      if (!isElement(child)) continue;
      if (isStyleElement(child)) {
        const css = collectStyleText(child);
        assertSafeSvgCss(css);
      }
      assertSafePresentationAttributes(child.properties);
      visit(child);
    }
  };

  visit(tree);
}

function moveTopLevelStylesIntoSvg(tree: Root, svg: Element): void {
  const topLevelStyles = (tree.children ?? []).filter(
    (child): child is Element => isElement(child) && isStyleElement(child),
  );

  if (topLevelStyles.length === 0) return;
  const svgChildren = svg.children ?? [];
  svg.children = [...topLevelStyles, ...svgChildren];
}

function rehypeDiagramSvgRoot() {
  return (tree: Root) => {
    ensureSafeDiagramTree(tree);
    const svg = findFirstSvg(tree);
    if (!svg) {
      throw new Error('Diagram output missing svg root');
    }
    moveTopLevelStylesIntoSvg(tree, svg);
    tree.children = [svg];
  };
}

export function sanitizeDiagramSvg(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const file = unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeDiagramTagValidator)
      .use(rehypeSanitize, diagramSanitizeSchema)
      .use(rehypeDiagramSvgRoot)
      .use(rehypeStringify)
      .processSync(trimmed);
    const sanitized = String(file).trim();
    return sanitized ? sanitized : null;
  } catch (_error) {
    return null;
  }
}

export function sanitizeMarkdownHtml(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const file = unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSanitize, markdownSanitizeSchema)
      .use(rehypeStringify)
      .processSync(trimmed);
    const sanitized = String(file).trim();
    return sanitized ? sanitized : null;
  } catch (_error) {
    return null;
  }
}
