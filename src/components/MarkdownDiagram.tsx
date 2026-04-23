import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { VisualizationSpec } from 'vega-lite';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

type DiagramLanguage = 'mermaid' | 'vega-lite';

interface MarkdownDiagramProps {
  language: DiagramLanguage;
  source: string;
  className?: string;
}

type DiagramState = 'idle' | 'loading' | 'ready' | 'error' | 'blocked';

const MAX_DIAGRAM_CHARS = 8000;
const INTERSECTION_MARGIN = '200px';

const diagramLabels: Record<DiagramLanguage, string> = {
  mermaid: 'Mermaid',
  'vega-lite': 'Vega-Lite',
};

function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : false,
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function useInView<T extends HTMLElement>(rootMargin: string): { ref: RefObject<T>; inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const target = ref.current;
    if (!target) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry || !entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}

function resolveCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return raw || fallback;
}

function buildVegaTheme(isDark: boolean) {
  const foreground = resolveCssVar('--foreground', isDark ? '#ffffff' : '#0F172A');
  const muted = resolveCssVar('--muted-foreground', isDark ? '#CBD5E1' : '#64748B');
  const border = resolveCssVar('--border', isDark ? '#334155' : '#E2E8F0');
  return {
    background: 'transparent',
    axis: {
      labelColor: muted,
      titleColor: foreground,
      gridColor: border,
      domainColor: border,
      tickColor: border,
    },
    legend: {
      labelColor: muted,
      titleColor: foreground,
    },
    title: {
      color: foreground,
    },
    view: {
      stroke: 'transparent',
    },
  };
}

function sanitizeMermaidSvg(svg: string): string {
  if (typeof window === 'undefined') return svg;
  try {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(svg, 'image/svg+xml');
    documentNode.querySelectorAll('script, foreignObject').forEach((node) => node.remove());
    documentNode.querySelectorAll('*').forEach((node) => {
      [...node.attributes].forEach((attr) => {
        if (attr.name.toLowerCase().startsWith('on')) {
          node.removeAttribute(attr.name);
        }
      });
    });
    return documentNode.documentElement.outerHTML;
  } catch (_error) {
    return svg;
  }
}

function validateVegaLiteSpec(source: string): { spec?: VisualizationSpec; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (_error) {
    return { error: 'Vega-Lite spec must be valid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Vega-Lite spec must be a JSON object.' };
  }

  const error = findVegaLiteError(parsed);
  if (error) {
    return { error };
  }

  return { spec: parsed as VisualizationSpec };
}

function findVegaLiteError(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const entry of node) {
      const error = findVegaLiteError(entry);
      if (error) return error;
    }
    return null;
  }

  const record = node as Record<string, unknown>;

  if ('data' in record) {
    const data = record.data;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const dataRecord = data as Record<string, unknown>;
      if ('url' in dataRecord) {
        return 'External data URLs are not allowed. Use inline values.';
      }
      if ('values' in dataRecord && dataRecord.values && !Array.isArray(dataRecord.values)) {
        return 'Vega-Lite data values must be an array.';
      }
    }
  }

  if ('datasets' in record) {
    const datasets = record.datasets;
    if (datasets && typeof datasets === 'object' && !Array.isArray(datasets)) {
      for (const [key, value] of Object.entries(datasets as Record<string, unknown>)) {
        if (!Array.isArray(value)) {
          return `Dataset "${key}" must use inline values.`;
        }
      }
    }
  }

  for (const value of Object.values(record)) {
    const error = findVegaLiteError(value);
    if (error) return error;
  }

  return null;
}

export function MarkdownDiagram({ language, source, className = '' }: MarkdownDiagramProps) {
  const trimmedSource = source.trim();
  const isTooLarge = trimmedSource.length > MAX_DIAGRAM_CHARS;
  const isDark = useIsDarkMode();
  const diagramId = useId().replace(/[:]/g, '_');
  const { ref: containerRef, inView } = useInView<HTMLDivElement>(INTERSECTION_MARGIN);
  const vegaRef = useRef<HTMLDivElement | null>(null);
  const vegaViewRef = useRef<{ finalize: () => void } | null>(null);
  const [state, setState] = useState<DiagramState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [isSourceOpen, setIsSourceOpen] = useState(isTooLarge);

  const validation = useMemo(() => {
    if (language !== 'vega-lite') return { spec: undefined, error: undefined };
    return validateVegaLiteSpec(trimmedSource);
  }, [language, trimmedSource]);

  useEffect(() => {
    if (isTooLarge) {
      setState('blocked');
      setErrorMessage(null);
      return;
    }

    if (language === 'vega-lite' && validation.error) {
      setState('error');
      setErrorMessage(validation.error);
      return;
    }

    if (!inView) {
      setState('idle');
      return;
    }

    if (!trimmedSource) {
      setState('error');
      setErrorMessage('Diagram source is empty.');
      return;
    }

    let cancelled = false;
    const render = async () => {
      setState('loading');
      setErrorMessage(null);

      try {
        if (language === 'mermaid') {
          const { default: mermaid } = await import('mermaid');
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: isDark ? 'dark' : 'default',
            flowchart: { htmlLabels: false },
            sequence: { htmlLabels: false },
          });
          const { svg } = await mermaid.render(diagramId, trimmedSource);
          if (cancelled) return;
          setSvgMarkup(sanitizeMermaidSvg(svg));
          setState('ready');
          return;
        }

        const { default: embed } = await import('vega-embed');
        const spec = validation.spec as VisualizationSpec | undefined;
        if (!spec) {
          throw new Error('Vega-Lite spec is missing.');
        }
        const themedConfig = buildVegaTheme(isDark);
        const mergedConfig = {
          ...themedConfig,
          ...(spec.config ?? {}),
          axis: { ...themedConfig.axis, ...(spec.config?.axis ?? {}) },
          legend: { ...themedConfig.legend, ...(spec.config?.legend ?? {}) },
          title: { ...themedConfig.title, ...(spec.config?.title ?? {}) },
          view: { ...themedConfig.view, ...(spec.config?.view ?? {}) },
        };
        const vegaSpec = { ...spec, config: mergedConfig };

        if (!vegaRef.current) {
          throw new Error('Vega container missing.');
        }
        vegaViewRef.current?.finalize();
        vegaRef.current.innerHTML = '';
        const result = await embed(vegaRef.current, vegaSpec, {
          actions: false,
          renderer: 'svg',
          logLevel: 'error',
        });
        if (cancelled) {
          result.view.finalize();
          return;
        }
        vegaViewRef.current = result.view;
        setState('ready');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Diagram failed to render.';
        setErrorMessage(message);
        setState('error');
      }
    };

    void render();
    return () => {
      cancelled = true;
      vegaViewRef.current?.finalize();
      vegaViewRef.current = null;
    };
  }, [diagramId, inView, isDark, isTooLarge, language, trimmedSource, validation]);

  useEffect(() => {
    if (state === 'error' || state === 'blocked') {
      setIsSourceOpen(true);
    }
  }, [state]);

  const fallbackNotice = isTooLarge
    ? `Diagram exceeds ${MAX_DIAGRAM_CHARS.toLocaleString()} characters. Rendering is skipped.`
    : null;

  const diagramLabel = diagramLabels[language];
  const showAlert = Boolean(fallbackNotice || (state === 'error' && errorMessage));
  const alertTitle = fallbackNotice ? 'Diagram too large' : `${diagramLabel} render failed`;
  const alertDescription = fallbackNotice ?? errorMessage ?? '';

  return (
    <div
      className={cn('my-4 flex w-full flex-col gap-2', className)}
      data-testid={`markdown-${language}`}
    >
      {showAlert ? (
        <Alert variant={fallbackNotice ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{alertTitle}</AlertTitle>
          <AlertDescription>{alertDescription}</AlertDescription>
        </Alert>
      ) : null}

      <div
        ref={containerRef}
        className="rounded-[12px] border border-[var(--agyn-border-subtle)] bg-white p-3"
        data-state={state}
      >
        {state === 'loading' || state === 'idle' ? (
          <div className="text-xs text-[var(--agyn-gray)]">Loading {diagramLabel} diagram...</div>
        ) : null}
        {state === 'error' ? (
          <div className="text-xs text-[var(--agyn-gray)]">Unable to render {diagramLabel} diagram.</div>
        ) : null}
        {state === 'blocked' ? (
          <div className="text-xs text-[var(--agyn-gray)]">Rendering skipped.</div>
        ) : null}
        {state === 'ready' && language === 'mermaid' && svgMarkup ? (
          <div
            className="max-w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : null}
        {language === 'vega-lite' ? <div className="max-w-full overflow-x-auto" ref={vegaRef} /> : null}
      </div>

      <Collapsible open={isSourceOpen} onOpenChange={setIsSourceOpen}>
        <CollapsibleTrigger
          className="self-start text-xs text-[var(--agyn-blue)] hover:text-[var(--agyn-purple)] underline"
          type="button"
        >
          {isSourceOpen ? 'Hide source' : 'View source'}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <pre className="w-full overflow-x-auto rounded-[10px] bg-[var(--agyn-bg-light)] p-3">
            <code className={`language-${language} block whitespace-pre-wrap font-mono text-xs text-[var(--agyn-dark)]`}>
              {trimmedSource}
            </code>
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
