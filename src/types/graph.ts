export interface PersistedGraphNode {
  id: string;
  template: string;
  config?: Record<string, unknown>;
  state?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface PersistedGraphEdge {
  id?: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface PersistedGraph {
  name: string;
  version: number;
  updatedAt: string;
  nodes: PersistedGraphNode[];
  edges: PersistedGraphEdge[];
  variables?: Array<{ key: string; value: string }>;
}
