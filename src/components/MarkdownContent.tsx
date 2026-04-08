import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { MARKDOWN_REMARK_PLUGINS, MARKDOWN_REHYPE_PLUGINS } from '@/lib/markdown/config';
import { cn } from '@/lib/utils';
import { MediaAudio } from './MediaAudio';
import { MediaImage } from './MediaImage';
import { MediaVideo } from './MediaVideo';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

type MarkdownCodeProps = ComponentPropsWithoutRef<'code'> & {
  inline?: boolean;
  node?: unknown;
};

type MarkdownPreProps = ComponentPropsWithoutRef<'pre'> & {
  node?: unknown;
};

type MarkdownImageProps = ComponentPropsWithoutRef<'img'> & {
  node?: unknown;
};

type MarkdownVideoProps = ComponentPropsWithoutRef<'video'> & {
  node?: unknown;
};

type MarkdownAudioProps = ComponentPropsWithoutRef<'audio'> & {
  node?: unknown;
};

type MarkdownSourceProps = ComponentPropsWithoutRef<'source'> & {
  node?: unknown;
};

type ReactMarkdownListInternals = {
  node?: unknown;
  ordered?: boolean;
  depth?: number;
  index?: number;
  checked?: boolean | null;
};

type MarkdownOrderedListProps = ComponentPropsWithoutRef<'ol'> & ReactMarkdownListInternals;
type MarkdownUnorderedListProps = ComponentPropsWithoutRef<'ul'> & ReactMarkdownListInternals;
type MarkdownListItemProps = ComponentPropsWithoutRef<'li'> & ReactMarkdownListInternals;

const getCodeRenderMeta = ({ inline, className }: MarkdownCodeProps) => {
  const match = /language-(\w+)/.exec(className || '');
  const isInlineCode = inline ?? !match;
  return { match, isInlineCode } as const;
};

const normalizeAltText = (alt?: string) => alt?.trim().toLowerCase() ?? '';
const AGYN_PROTOCOL_PREFIX = 'agyn:';

function urlTransform(url: string): string {
  if (url.startsWith(AGYN_PROTOCOL_PREFIX)) {
    return url;
  }
  return defaultUrlTransform(url);
}

const resolveSourceFromChildren = (children: ReactNode): string | null => {
  const nodes = Children.toArray(children);
  for (const node of nodes) {
    if (!isValidElement<MarkdownSourceProps>(node)) {
      continue;
    }
    if (node.type !== 'source') {
      continue;
    }
    const src = typeof node.props.src === 'string' ? node.props.src.trim() : '';
    if (src) {
      return src;
    }
  }
  return null;
};

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const renderCode = ({ inline, className: codeClassName, children, style, ...props }: MarkdownCodeProps) => {
    const { match, isInlineCode } = getCodeRenderMeta({ inline, className: codeClassName });
    const text = String(children).replace(/\n$/, '');

    if (!isInlineCode) {
      return (
        <code
          className={[
            'block whitespace-pre-wrap font-mono text-sm leading-relaxed text-[var(--agyn-dark)]',
            match ? `language-${match[1]}` : null,
            codeClassName,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          {text}
        </code>
      );
    }

    return (
      <code
        className="bg-[var(--agyn-bg-light)] text-[var(--agyn-purple)] px-1.5 py-0.5 rounded text-sm break-words max-w-full whitespace-pre-wrap"
        style={{ overflowWrap: 'break-word', wordBreak: 'break-word', ...style }}
        {...props}
      >
        {children}
      </code>
    );
  };

  const markdownComponents: Components = {
    // Headings
    h1: ({ children }) => (
      <h1 className="text-[var(--agyn-dark)] mb-4 mt-6 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-[var(--agyn-dark)] mb-3 mt-5 first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-[var(--agyn-dark)] mb-2 mt-4 first:mt-0">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-[var(--agyn-dark)] mb-2 mt-3 first:mt-0">
        {children}
      </h4>
    ),
    h5: ({ children }) => (
      <h5 className="text-[var(--agyn-dark)] mb-2 mt-3 first:mt-0">
        {children}
      </h5>
    ),
    h6: ({ children }) => (
      <h6 className="text-[var(--agyn-dark)] mb-2 mt-3 first:mt-0">
        {children}
      </h6>
    ),

    // Paragraphs
    p: ({ children }) => (
      <p className="text-[var(--agyn-dark)] mb-4 last:mb-0 leading-relaxed">
        {children}
      </p>
    ),

    // Lists
    ul: ({ children, className, node: _node, depth: _depth, ordered: _ordered, ...domProps }: MarkdownUnorderedListProps) => (
      <ul
        className={cn('list-disc list-outside ml-5 mb-4 space-y-1 text-[var(--agyn-dark)]', className)}
        {...domProps}
      >
        {children}
      </ul>
    ),
    ol: ({ children, className, node: _node, depth: _depth, ordered: _ordered, index: _index, ...domProps }: MarkdownOrderedListProps) => (
      <ol
        className={cn('list-decimal list-outside ml-5 mb-4 space-y-1 text-[var(--agyn-dark)]', className)}
        {...domProps}
      >
        {children}
      </ol>
    ),
    li: ({ children, className, node: _node, ordered: _ordered, index: _index, checked: _checked, depth: _depth, ...domProps }: MarkdownListItemProps) => (
      <li className={cn('text-[var(--agyn-dark)] leading-relaxed', className)} {...domProps}>
        {children}
      </li>
    ),

    // Inline code
    code: renderCode,

    img: ({ src, alt, title, className: imageClassName, node: _node }: MarkdownImageProps) => {
      const normalizedAlt = normalizeAltText(alt);
      const resolvedSrc = typeof src === 'string' ? src : '';

      if (normalizedAlt === 'video') {
        return <MediaVideo src={resolvedSrc} className={imageClassName} />;
      }

      if (normalizedAlt === 'audio') {
        return <MediaAudio src={resolvedSrc} className={imageClassName} />;
      }

      return <MediaImage src={resolvedSrc} alt={alt ?? ''} title={title} className={imageClassName} />;
    },

    video: ({ src, children, className: videoClassName, node: _node }: MarkdownVideoProps) => {
      const resolvedSrc = typeof src === 'string' && src.trim() ? src : resolveSourceFromChildren(children) ?? '';
      return <MediaVideo src={resolvedSrc} className={videoClassName} />;
    },

    audio: ({ src, children, className: audioClassName, node: _node }: MarkdownAudioProps) => {
      const resolvedSrc = typeof src === 'string' && src.trim() ? src : resolveSourceFromChildren(children) ?? '';
      return <MediaAudio src={resolvedSrc} className={audioClassName} />;
    },

    source: ({ node: _node, ..._props }: MarkdownSourceProps) => null,

    picture: ({ children }) => (
      <span className="block max-w-full">
        {children}
      </span>
    ),

    // Code blocks
    pre: ({ children, className: preClassName, style: preStyle, node: _node, ...props }: MarkdownPreProps) => {
      const childArray = Children.toArray(children);
      const firstElement = childArray.find((node): node is ReactElement => isValidElement(node));

      if (firstElement && firstElement.type === 'pre') {
        return firstElement;
      }

      const mergedClassName = [
        'my-4 w-full overflow-x-auto rounded-[10px] bg-[var(--agyn-bg-light)] p-3 font-mono text-sm leading-relaxed text-[var(--agyn-dark)]',
        preClassName,
      ]
        .filter(Boolean)
        .join(' ');

      const mergedStyle = {
        whiteSpace: 'pre-wrap' as const,
        wordBreak: 'break-word' as const,
        minWidth: 0,
        maxWidth: '100%',
        ...(preStyle ?? {}),
      };

      return (
        <pre className={mergedClassName} style={mergedStyle} {...props}>
          {childArray.map((node: ReactNode) => {
            if (!isValidElement<{ className?: string }>(node)) {
              return node;
            }

            const mergedChildClassName = [
              'block whitespace-pre-wrap font-mono text-sm leading-relaxed text-[var(--agyn-dark)]',
              node.props.className,
            ]
              .filter(Boolean)
              .join(' ');

            return cloneElement(node, { className: mergedChildClassName });
          })}
        </pre>
      );
    },

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-[var(--agyn-blue)] bg-[var(--agyn-bg-light)] pl-4 pr-4 py-3 my-4 italic text-[var(--agyn-dark)]">
        {children}
      </blockquote>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        href={typeof href === 'string' ? href : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--agyn-blue)] hover:text-[var(--agyn-purple)] underline transition-colors"
      >
        {children}
      </a>
    ),

    // Horizontal rule
    hr: () => (
      <hr className="border-0 border-t border-[var(--agyn-border-subtle)] my-6" />
    ),

    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border border-[var(--agyn-border-subtle)] rounded-[6px]">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-[var(--agyn-bg-light)]">
        {children}
      </thead>
    ),
    tbody: ({ children }) => (
      <tbody>
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="border-b border-[var(--agyn-border-subtle)] last:border-b-0">
        {children}
      </tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-[var(--agyn-dark)] border-r border-[var(--agyn-border-subtle)] last:border-r-0">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-[var(--agyn-dark)] border-r border-[var(--agyn-border-subtle)] last:border-r-0">
        {children}
      </td>
    ),

    // Strong (bold)
    strong: ({ children }) => (
      <strong className="text-[var(--agyn-dark)]">
        {children}
      </strong>
    ),

    // Emphasis (italic)
    em: ({ children }) => (
      <em className="text-[var(--agyn-dark)]">
        {children}
      </em>
    ),

    // Strikethrough
    del: ({ children }) => (
      <del className="text-[var(--agyn-gray)] opacity-70">
        {children}
      </del>
    ),
  };

  return (
    <div
      className={`markdown-content w-full min-w-0 ${className}`}
      style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}
    >
      <ReactMarkdown
        remarkPlugins={MARKDOWN_REMARK_PLUGINS}
        rehypePlugins={MARKDOWN_REHYPE_PLUGINS}
        components={markdownComponents}
        urlTransform={urlTransform}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
