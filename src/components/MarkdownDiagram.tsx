import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { AlertTriangle } from 'lucide-react';
import type { EmbedOptions } from 'vega-embed';
import type { VisualizationSpec } from 'vega-lite';
import { cn } from '@/lib/utils';
import { sanitizeDiagramSvg } from '@/lib/markdown/sanitize';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

type DiagramLanguage = 'mermaid' | 'vega-lite';

interface MarkdownDiagramProps {
  language: DiagramLanguage;
  source: string;
  className?: string;
}

type DiagramState = 'idle' | 'loading' | 'ready' | 'error' | 'blocked';

const MAX_DIAGRAM_CHARS = 200000;
const INTERSECTION_MARGIN = '200px';
const LazyVegaLiteRenderer = lazy(() => import('./VegaLiteRenderer'));

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

function isElementInView(element: HTMLElement, margin: number): boolean {
  if (typeof window === 'undefined') return true;
  const rect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  return (
    rect.bottom >= -margin &&
    rect.top <= viewportHeight + margin &&
    rect.right >= -margin &&
    rect.left <= viewportWidth + margin
  );
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

    const parsedMargin = Number.parseFloat(rootMargin);
    const margin = Number.isFinite(parsedMargin) ? parsedMargin : 0;

    if (isElementInView(target, margin)) {
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

    const checkInView = () => {
      if (!isElementInView(target, margin)) return;
      setInView(true);
      observer.disconnect();
    };

    const timeoutId = window.setTimeout(checkInView, 500);
    const rafId = window.requestAnimationFrame(checkInView);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
      window.cancelAnimationFrame(rafId);
    };
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

function sanitizeSvgMarkup(svg: string): string | null {
  return sanitizeDiagramSvg(svg);
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
  const [state, setState] = useState<DiagramState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [isSourceOpen, setIsSourceOpen] = useState(isTooLarge);

  const validation = useMemo(() => {
    if (language !== 'vega-lite') return { spec: undefined, error: undefined };
    return validateVegaLiteSpec(trimmedSource);
  }, [language, trimmedSource]);

  useEffect(() => {
    setSvgMarkup(null);
    setErrorMessage(null);

    if (isTooLarge) {
      setState('blocked');
      return;
    }

    if (!trimmedSource) {
      setState('error');
      setErrorMessage('Diagram source is empty.');
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

    setState('loading');

    if (language !== 'mermaid') return;

    let cancelled = false;
    const renderMermaid = async () => {
      try {
        const { default: mermaid } = await import('mermaid');
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDark ? 'dark' : 'default',
          htmlLabels: false,
        });
        const { svg } = await mermaid.render(diagramId, trimmedSource);
        if (cancelled) return;
        const sanitized = sanitizeSvgMarkup(svg);
        if (!sanitized) {
          throw new Error('Mermaid output failed sanitization.');
        }
        setSvgMarkup(sanitized);
        setState('ready');
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Diagram failed to render.';
        setErrorMessage(message);
        setState('error');
      }
    };

    void renderMermaid();
    return () => {
      cancelled = true;
    };
  }, [diagramId, inView, isDark, isTooLarge, language, trimmedSource, validation.error]);

  useEffect(() => {
    if (state === 'error' || state === 'blocked') {
      setIsSourceOpen(true);
    }
  }, [state]);

  const handleVegaSvg = useCallback((svg: string) => {
    const sanitized = sanitizeSvgMarkup(svg);
    if (!sanitized) {
      setSvgMarkup(null);
      setErrorMessage('Vega-Lite output failed sanitization.');
      setState('error');
      return;
    }
    setSvgMarkup(sanitized);
    setState('ready');
  }, []);

  const handleVegaError = useCallback((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Diagram failed to render.';
    setSvgMarkup(null);
    setErrorMessage(message);
    setState('error');
  }, []);

  const fallbackNotice = isTooLarge
    ? `Diagram exceeds ${MAX_DIAGRAM_CHARS.toLocaleString()} characters. Rendering is skipped.`
    : null;

  const diagramLabel = diagramLabels[language];
  const showAlert = Boolean(fallbackNotice || (state === 'error' && errorMessage));
  const alertTitle = fallbackNotice ? 'Diagram too large' : `${diagramLabel} render failed`;
  const alertDescription = fallbackNotice ?? errorMessage ?? '';
  const shouldForceSourceOpen = state !== 'ready';
  const sourceOpen = shouldForceSourceOpen || isSourceOpen;
  const handleSourceToggle = (open: boolean) => {
    if (shouldForceSourceOpen) return;
    setIsSourceOpen(open);
  };
  const shouldRenderVega =
    language === 'vega-lite' &&
    state === 'loading' &&
    inView &&
    !isTooLarge &&
    !validation.error &&
    Boolean(trimmedSource);
  const vegaSpec = useMemo(() => {
    const spec = validation.spec as VisualizationSpec | undefined;
    if (!spec) return undefined;
    const themedConfig = buildVegaTheme(isDark);
    const mergedConfig = {
      ...themedConfig,
      ...(spec.config ?? {}),
      axis: { ...themedConfig.axis, ...(spec.config?.axis ?? {}) },
      legend: { ...themedConfig.legend, ...(spec.config?.legend ?? {}) },
      title: { ...themedConfig.title, ...(spec.config?.title ?? {}) },
      view: { ...themedConfig.view, ...(spec.config?.view ?? {}) },
    };
    return { ...spec, config: mergedConfig };
  }, [isDark, validation.spec]);
  const vegaOptions: EmbedOptions = useMemo(
    () => ({
      actions: false,
      renderer: 'svg',
      logLevel: 'error',
    }),
    [],
  );

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
        className="rounded-[12px] border border-[var(--border)] bg-[var(--background)] p-3"
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
        {state === 'ready' && svgMarkup ? (
          <div
            className="max-w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : null}
        {language === 'vega-lite' && shouldRenderVega && vegaSpec ? (
          <Suspense fallback={null}>
            <LazyVegaLiteRenderer
              spec={vegaSpec}
              options={vegaOptions}
              onSvgReady={handleVegaSvg}
              onError={handleVegaError}
            />
          </Suspense>
        ) : null}
      </div>

      <Collapsible open={sourceOpen} onOpenChange={handleSourceToggle}>
        <CollapsibleTrigger
          className="self-start text-xs text-[var(--agyn-blue)] hover:text-[var(--agyn-purple)] underline"
          type="button"
          disabled={shouldForceSourceOpen}
        >
          {sourceOpen ? 'Hide source' : 'View source'}
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
