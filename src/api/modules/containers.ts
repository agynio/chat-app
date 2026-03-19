import { containers } from '@/api/mock-data/containers';
import { createId } from '@/api/mock-data/id';

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

export type ContainerEventItem = {
  id: string;
  containerId: string;
  eventType: string;
  exitCode: number | null;
  signal: string | null;
  health: string | null;
  reason: string | null;
  message: string | null;
  createdAt: string;
};

export type ContainerEventsResponse = {
  items: ContainerEventItem[];
  page: {
    limit: number;
    order: 'asc' | 'desc';
    nextBefore: string | null;
    nextAfter: string | null;
  };
};

const cloneContainer = (container: ContainerItem): ContainerItem => ({
  ...container,
  sidecars: container.sidecars ? container.sidecars.map((sidecar) => ({ ...sidecar })) : undefined,
  mounts: container.mounts ? container.mounts.map((mount) => ({ ...mount })) : undefined,
});

export function listContainers(params: { status?: string; sortBy?: string; sortDir?: string; threadId?: string }) {
  const { status, sortBy, sortDir, threadId } = params;
  let items = containers;
  if (threadId) {
    items = items.filter((container) => container.threadId === threadId);
  }
  if (status && status !== 'all') {
    items = items.filter((container) => container.status === status);
  }
  if (sortBy) {
    const direction = sortDir === 'asc' ? 1 : -1;
    const sorted = [...items];
    sorted.sort((a, b) => {
      if (sortBy === 'lastUsedAt') {
        return (Date.parse(a.lastUsedAt) - Date.parse(b.lastUsedAt)) * direction;
      }
      if (sortBy === 'startedAt') {
        return (Date.parse(a.startedAt) - Date.parse(b.startedAt)) * direction;
      }
      return 0;
    });
    items = sorted;
  }
  return Promise.resolve({ items: items.map(cloneContainer) });
}

export function listContainerEvents(
  containerId: string,
  params: { limit?: number; order?: 'asc' | 'desc'; since?: string; cursor?: string } = {},
) {
  if (!containerId) {
    return Promise.reject(new Error('containerId is required'));
  }
  const exists = containers.some((container) => container.containerId === containerId);
  if (!exists) {
    return Promise.reject(new Error('Container not found'));
  }
  const limit = typeof params.limit === 'number' ? params.limit : 50;
  const order: 'asc' | 'desc' = params.order ?? 'desc';
  const response: ContainerEventsResponse = {
    items: [],
    page: {
      limit,
      order,
      nextBefore: null,
      nextAfter: null,
    },
  };
  return Promise.resolve(response);
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
  const cols = body.cols ?? 80;
  const rows = body.rows ?? 24;
  const shell = body.shell?.trim() || '/bin/bash';
  const session: ContainerTerminalSessionResponse = {
    sessionId: createId(),
    token: createId(),
    wsUrl: `/api/containers/${encodeURIComponent(containerId)}/terminal/ws`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    negotiated: { shell, cols, rows },
  };
  return Promise.resolve(session);
}

export function deleteContainer(containerId: string) {
  if (!containerId) {
    return Promise.reject(new Error('containerId is required'));
  }
  const index = containers.findIndex((container) => container.containerId === containerId);
  if (index === -1) {
    return Promise.reject(new Error('Container not found'));
  }
  containers.splice(index, 1);
  return Promise.resolve();
}
