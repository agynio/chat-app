import { useEffect, useRef } from 'react';
import { useVegaEmbed } from 'react-vega';
import type { EmbedOptions } from 'vega-embed';
import type { VisualizationSpec } from 'vega-lite';

interface VegaLiteRendererProps {
  spec: VisualizationSpec;
  options: EmbedOptions;
  onSvgReady: (svg: string) => void;
  onError: (error: unknown) => void;
}

export default function VegaLiteRenderer({ spec, options, onSvgReady, onError }: VegaLiteRendererProps) {
  const ref = useRef<HTMLDivElement>(null);
  const embedResult = useVegaEmbed({ ref, spec, options, onError });

  useEffect(() => {
    if (!embedResult) return;
    let cancelled = false;
    const currentRef = ref.current;

    const renderSvg = async () => {
      try {
        const svg = await embedResult.view.toSVG();
        if (cancelled) return;
        onSvgReady(svg);
      } catch (error) {
        if (cancelled) return;
        onError(error);
      } finally {
        embedResult.view.finalize();
        if (currentRef) {
          currentRef.innerHTML = '';
        }
      }
    };

    void renderSvg();

    return () => {
      cancelled = true;
      embedResult.view.finalize();
      if (currentRef) {
        currentRef.innerHTML = '';
      }
    };
  }, [embedResult, onError, onSvgReady]);

  return <div ref={ref} className="hidden" aria-hidden="true" />;
}
