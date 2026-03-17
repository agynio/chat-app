import { http } from '@/api/http';

export type ContainerItem = {
  containerId: string;
  threadId: string | null;
  image: string;
  name: string;
  status: 'running' | 'stopped' | 'terminating' | 'failed';
  startedAt: string;
  lastUsedAt: string;
  killAfterAt: string | null;
  // Derived from metadata.labels['hautech.ai/role']
  role: 'workspace' | 'sidecar' | string;
  // Optional sidecars attached to this container (e.g., DinD)
  sidecars?: Array<{ containerId: string; role: 'sidecar' | 'dind'; image: string; status: 'running'|'stopped'|'terminating'|'failed'; name: string }>;
  mounts?: Array<{ source: string; destination: string }>;
};

export function listContainers(params: { status?: string; sortBy?: string; sortDir?: string; threadId?: string }) {
  return http.get<{ items: ContainerItem[] }>(`/api/containers`, { params });
}

export type ContainerTerminalSessionResponse = {
  sessionId: string;
  token: string;
  wsUrl: string;
  expiresAt: string;
  negotiated: { shell: string; cols: number; rows: number };
};

export type CreateTerminalSessionInput = {
  cols?: number;
  rows?: number;
  shell?: string;
};

export function createContainerTerminalSession(containerId: string, body: CreateTerminalSessionInput = {}) {
  return http.post<ContainerTerminalSessionResponse>(`/api/containers/${containerId}/terminal/sessions`, body);
}
