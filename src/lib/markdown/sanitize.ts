import type { Schema } from 'hast-util-sanitize';

const allowedTagNames: Schema['tagNames'] = [
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

const allowedProtocols: string[] = ['http', 'https', 'mailto'];

export const markdownSanitizeSchema: Schema = {
  tagNames: allowedTagNames,
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
  },
  protocols: {
    href: [...allowedProtocols],
    src: ['http', 'https', 'agyn'],
  },
};
