type TraceBytes = string | Uint8Array | number[] | null | undefined;

export type TraceSpanWire = {
  traceId?: TraceBytes;
  trace_id?: TraceBytes;
};

export type TraceScopeSpansWire = {
  spans?: TraceSpanWire[];
};

export type TraceResourceSpansWire = {
  scopeSpans?: TraceScopeSpansWire[];
  scope_spans?: TraceScopeSpansWire[];
};

export type ListSpansResponseWire = {
  resourceSpans?: TraceResourceSpansWire[];
  resource_spans?: TraceResourceSpansWire[];
  nextPageToken?: string;
  next_page_token?: string;
};
