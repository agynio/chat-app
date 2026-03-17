import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { Eye, Code, SplitSquareVertical } from 'lucide-react';
import { Button } from './Button';
import { SegmentedControl } from './SegmentedControl';
import { MarkdownContent } from './MarkdownContent';

interface FullscreenMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  label?: string;
  previewTransform?: (value: string) => string;
}

type ViewMode = 'split' | 'edit' | 'preview';

type ScrollSource = 'editor' | 'preview';

const clampRatio = (value: number): number => {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
};

const getScrollRatio = (element: HTMLElement): number => {
  const maxScroll = element.scrollHeight - element.clientHeight;

  if (maxScroll <= 0) {
    return 0;
  }

  return element.scrollTop / maxScroll;
};

const scheduleScrollUpdate = (
  target: HTMLElement,
  ratio: number,
  ignoreRef: MutableRefObject<boolean>,
  rafRef: MutableRefObject<number | null>
) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (rafRef.current !== null) {
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    ignoreRef.current = false;
  }

  ignoreRef.current = true;

  const firstFrame = window.requestAnimationFrame(() => {
    const maxScroll = target.scrollHeight - target.clientHeight;
    const safeRatio = Number.isFinite(ratio) ? clampRatio(ratio) : 0;

    if (maxScroll <= 0) {
      target.scrollTop = 0;
      ignoreRef.current = false;
      rafRef.current = null;
      return;
    }

    target.scrollTop = safeRatio * maxScroll;

    rafRef.current = window.requestAnimationFrame(() => {
      ignoreRef.current = false;
      rafRef.current = null;
    });
  });

  rafRef.current = firstFrame;
};

interface ScrollSyncOptions {
  editorRef: MutableRefObject<HTMLTextAreaElement | null>;
  previewScrollRef: MutableRefObject<HTMLDivElement | null>;
  previewContentRef: MutableRefObject<HTMLDivElement | null>;
  isEnabled: boolean;
  content: string;
}

const useScrollSync = ({
  editorRef,
  previewScrollRef,
  previewContentRef,
  isEnabled,
  content
}: ScrollSyncOptions) => {
  const editorIgnoreRef = useRef(false);
  const previewIgnoreRef = useRef(false);
  const editorRafRef = useRef<number | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const lastEditorRatioRef = useRef(0);
  const lastPreviewRatioRef = useRef(0);
  const lastSourceRef = useRef<ScrollSource>('editor');

  const reapplyAlignment = useCallback(() => {
    if (!isEnabled || typeof window === 'undefined') {
      return;
    }

    const editor = editorRef.current;
    const preview = previewScrollRef.current;

    if (!editor || !preview) {
      return;
    }

    if (lastSourceRef.current === 'preview') {
      const ratio = getScrollRatio(preview);
      lastPreviewRatioRef.current = ratio;
      lastEditorRatioRef.current = ratio;
      scheduleScrollUpdate(editor, ratio, editorIgnoreRef, editorRafRef);
      return;
    }

    const ratio = getScrollRatio(editor);
    lastEditorRatioRef.current = ratio;
    lastPreviewRatioRef.current = ratio;
    scheduleScrollUpdate(preview, ratio, previewIgnoreRef, previewRafRef);
  }, [editorRef, previewScrollRef, isEnabled]);

  const handleEditorScroll = useCallback(() => {
    if (!isEnabled) {
      return;
    }

    const editor = editorRef.current;
    const preview = previewScrollRef.current;

    if (!editor || !preview || editorIgnoreRef.current) {
      return;
    }

    const ratio = getScrollRatio(editor);
    lastSourceRef.current = 'editor';
    lastEditorRatioRef.current = ratio;
    lastPreviewRatioRef.current = ratio;
    scheduleScrollUpdate(preview, ratio, previewIgnoreRef, previewRafRef);
  }, [editorRef, previewScrollRef, isEnabled]);

  const handlePreviewScroll = useCallback(() => {
    if (!isEnabled) {
      return;
    }

    const editor = editorRef.current;
    const preview = previewScrollRef.current;

    if (!editor || !preview || previewIgnoreRef.current) {
      return;
    }

    const ratio = getScrollRatio(preview);
    lastSourceRef.current = 'preview';
    lastPreviewRatioRef.current = ratio;
    lastEditorRatioRef.current = ratio;
    scheduleScrollUpdate(editor, ratio, editorIgnoreRef, editorRafRef);
  }, [editorRef, previewScrollRef, isEnabled]);

  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') {
      return;
    }

    const editor = editorRef.current;
    const preview = previewScrollRef.current;

    if (!editor || !preview) {
      return;
    }

    const onEditorScroll = () => handleEditorScroll();
    const onPreviewScroll = () => handlePreviewScroll();

    editor.addEventListener('scroll', onEditorScroll, { passive: true });
    preview.addEventListener('scroll', onPreviewScroll, { passive: true });

    reapplyAlignment();

    return () => {
      editor.removeEventListener('scroll', onEditorScroll);
      preview.removeEventListener('scroll', onPreviewScroll);

      if (editorRafRef.current !== null) {
        window.cancelAnimationFrame(editorRafRef.current);
        editorRafRef.current = null;
      }

      if (previewRafRef.current !== null) {
        window.cancelAnimationFrame(previewRafRef.current);
        previewRafRef.current = null;
      }

      editorIgnoreRef.current = false;
      previewIgnoreRef.current = false;
    };
  }, [editorRef, previewScrollRef, isEnabled, handleEditorScroll, handlePreviewScroll, reapplyAlignment]);

  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      reapplyAlignment();
    };

    window.addEventListener('resize', handleResize);

    let resizeObserver: ResizeObserver | null = null;

    if ('ResizeObserver' in window) {
      resizeObserver = new window.ResizeObserver(handleResize);

      const editor = editorRef.current;
      const preview = previewScrollRef.current;
      const previewContent = previewContentRef.current;

      if (editor) {
        resizeObserver.observe(editor);
      }

      if (preview) {
        resizeObserver.observe(preview);
      }

      if (previewContent) {
        resizeObserver.observe(previewContent);
      }
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver?.disconnect();
    };
  }, [editorRef, previewScrollRef, previewContentRef, isEnabled, content, reapplyAlignment]);
};

export function FullscreenMarkdownEditor({
  value,
  onChange,
  onClose,
  label = 'Markdown editor',
  previewTransform,
}: FullscreenMarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const previewScrollRef = useRef<HTMLDivElement | null>(null);
  const previewContentRef = useRef<HTMLDivElement | null>(null);

  const showEditor = viewMode === 'split' || viewMode === 'edit';
  const showPreview = viewMode === 'split' || viewMode === 'preview';

  const transformed = useMemo(() => {
    return previewTransform ? previewTransform(value) : value;
  }, [value, previewTransform]);

  useScrollSync({
    editorRef,
    previewScrollRef,
    previewContentRef,
    isEnabled: viewMode === 'split',
    content: value,
  });

  useEffect(() => {
    if (!showEditor) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
  }, [showEditor]);

  const options = [
    { label: 'Split', value: 'split', icon: <SplitSquareVertical className="h-4 w-4" /> },
    { label: 'Edit', value: 'edit', icon: <Code className="h-4 w-4" /> },
    { label: 'Preview', value: 'preview', icon: <Eye className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[var(--agyn-border-subtle)] px-6 py-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--agyn-dark)]">{label}</h2>
          <p className="text-sm text-[var(--agyn-text-subtle)]">
            {viewMode === 'split'
              ? 'Editing with a live preview.'
              : viewMode === 'edit'
                ? 'Write your markdown.'
                : 'Preview the rendered markdown.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SegmentedControl
            value={viewMode}
            options={options}
            onChange={(next) => setViewMode(next as ViewMode)}
          />
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-2">
          {showEditor && (
            <div className="flex flex-1 flex-col border-r border-[var(--agyn-border-subtle)]">
              <div className="flex items-center justify-between border-b border-[var(--agyn-border-subtle)] px-4 py-2 text-sm font-medium text-[var(--agyn-dark)]">
                <span>Markdown</span>
                <span className="text-xs text-[var(--agyn-text-subtle)]">Live editing</span>
              </div>
              <textarea
                ref={editorRef}
                className="flex-1 resize-none bg-white p-4 text-sm leading-relaxed text-[var(--agyn-dark)] focus-visible:outline-hidden"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Write markdown here..."
              />
            </div>
          )}

          {showPreview && (
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-[var(--agyn-border-subtle)] px-4 py-2 text-sm font-medium text-[var(--agyn-dark)]">
                <span>Preview</span>
                <span className="text-xs text-[var(--agyn-text-subtle)]">Rendered output</span>
              </div>
              <div ref={previewScrollRef} className="flex-1 overflow-y-auto bg-white px-6 py-4">
                <div ref={previewContentRef}>
                  <MarkdownContent content={transformed} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
