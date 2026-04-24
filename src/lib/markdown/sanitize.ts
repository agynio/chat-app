import type { Schema } from 'hast-util-sanitize';
import rehypeParse from 'rehype-parse';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';

const markdownTagNames: Schema['tagNames'] = [
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

const diagramSvgTagNames: Schema['tagNames'] = [...svgTagNames, 'style'];
const allowedTagNames: Schema['tagNames'] = [...markdownTagNames, ...svgTagNames];

const allowedProtocols: string[] = ['http', 'https', 'mailto'];

const markdownAttributes: Schema['attributes'] = {
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
};

const svgAttributes: Schema['attributes'] = {
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
};

export const markdownSanitizeSchema: Schema = {
  tagNames: allowedTagNames,
  attributes: {
    ...markdownAttributes,
    ...svgAttributes,
  },
  protocols: {
    href: [...allowedProtocols],
    src: ['http', 'https', 'agyn'],
    xLinkHref: ['#'],
    xlinkHref: ['#'],
  },
};

const diagramSanitizeSchema: Schema = {
  tagNames: diagramSvgTagNames,
  attributes: {
    ...svgAttributes,
    style: ['type'],
  },
  protocols: {
    xLinkHref: ['#'],
    xlinkHref: ['#'],
  },
};

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
};

const cssImportPattern = /@import\s+[^;]+;?/gi;
const cssFontFacePattern = /@font-face\s*{[\s\S]*?}/gi;
const cssUrlPattern = /url\(([^)]+)\)/gi;

function isSafeSvgUrl(value: string): boolean {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');
  return trimmed.startsWith('#');
}

function sanitizeSvgCss(value: string): string {
  const withoutAtRules = value.replace(cssImportPattern, '').replace(cssFontFacePattern, '');
  return withoutAtRules.replace(cssUrlPattern, (match, urlValue) => {
    return isSafeSvgUrl(urlValue) ? match : '';
  });
}

function sanitizeSvgStyles(node: HastNode): void {
  if (node.type === 'element') {
    const properties = node.properties ?? {};
    const styleValue = properties.style;
    if (typeof styleValue === 'string') {
      const sanitized = sanitizeSvgCss(styleValue);
      if (sanitized.trim()) {
        properties.style = sanitized;
      } else {
        delete properties.style;
      }
    }

    if (node.tagName === 'style') {
      for (const child of node.children ?? []) {
        if (child.type === 'text' && typeof child.value === 'string') {
          child.value = sanitizeSvgCss(child.value);
        }
      }
    }
  }

  for (const child of node.children ?? []) {
    sanitizeSvgStyles(child);
  }
}

function rehypeDiagramCssFilter() {
  return (tree: HastNode) => {
    sanitizeSvgStyles(tree);
  };
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

export function sanitizeDiagramSvg(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const file = unified()
      .use(rehypeParse, { fragment: true })
      .use(rehypeSanitize, diagramSanitizeSchema)
      .use(rehypeDiagramCssFilter)
      .use(rehypeStringify)
      .processSync(trimmed);
    const sanitized = String(file).trim();
    return sanitized ? sanitized : null;
  } catch (_error) {
    return null;
  }
}
