import type { ListSpansResponseWire, TraceResourceSpansWire } from '@/api/types/tracing';

const TRACE_ID_HEX_LENGTH = 32;

function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeTraceId(traceId: string | Uint8Array | number[] | null | undefined): string | null {
  if (!traceId) return null;
  if (typeof traceId === 'string') {
    const normalized = traceId.trim().replace(/^0x/i, '').toLowerCase();
    return /^[0-9a-f]{32}$/.test(normalized) ? normalized : null;
  }
  const hex = bytesToHex(traceId).toLowerCase();
  return hex.length === TRACE_ID_HEX_LENGTH ? hex : null;
}

function getResourceSpans(response: ListSpansResponseWire): TraceResourceSpansWire[] {
  return response.resourceSpans ?? response.resource_spans ?? [];
}

export function extractRunIdFromListSpans(response: ListSpansResponseWire): string | null {
  for (const resourceSpan of getResourceSpans(response)) {
    const scopeSpans = resourceSpan.scopeSpans ?? resourceSpan.scope_spans ?? [];
    for (const scopeSpan of scopeSpans) {
      for (const span of scopeSpan.spans ?? []) {
        const traceId = decodeTraceId(span.traceId ?? span.trace_id);
        if (traceId) return traceId;
      }
    }
  }
  return null;
}
