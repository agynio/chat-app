import type { VisualizationSpec } from 'vega-lite';

export function validateVegaLiteSpec(source: string): { spec?: VisualizationSpec; error?: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch (_error) {
    return { error: 'Vega-Lite spec must be valid JSON.' };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { error: 'Vega-Lite spec must be a JSON object.' };
  }

  if (!isValidVegaLiteViewSpec(parsed)) {
    return { error: 'Vega-Lite spec must include data, mark, and encoding.' };
  }

  const error = findVegaLiteError(parsed);
  if (error) {
    return { error };
  }

  return { spec: parsed as VisualizationSpec };
}

function isValidVegaLiteViewSpec(node: unknown): boolean {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
  const record = node as Record<string, unknown>;
  return Boolean(record.data && record.mark && record.encoding);
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
