import { containers } from '@/api/mock-data/containers';

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
  if (status) {
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
  if (!globalThis.crypto?.randomUUID) {
    throw new Error('Missing crypto.randomUUID');
  }
  const cols = typeof body.cols === 'number' ? body.cols : 80;
  const rows = typeof body.rows === 'number' ? body.rows : 24;
  const shell = typeof body.shell === 'string' && body.shell.trim() ? body.shell.trim() : '/bin/bash';
  const session: ContainerTerminalSessionResponse = {
    sessionId: globalThis.crypto.randomUUID(),
    token: globalThis.crypto.randomUUID(),
    wsUrl: `/api/containers/${encodeURIComponent(containerId)}/terminal/ws`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    negotiated: { shell, cols, rows },
  };
  return Promise.resolve(session);
}
