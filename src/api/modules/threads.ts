import { http } from '@/api/http';
import type { ThreadMetrics, ThreadNode, ThreadReminder } from '@/api/types/agents';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const clampTake = (value: number | undefined, fallback = 200) => {
  if (!Number.isFinite(value)) return fallback;
  const coerced = Math.trunc(value as number);
  return Math.min(1000, Math.max(1, coerced));
};

export type ThreadTreeItem = ThreadNode & {
  children?: ThreadTreeItem[];
  hasChildren?: boolean;
};

export const threads = {
  roots: (status: 'open' | 'closed' | 'all' = 'open', limit = 100) =>
    http.get<{ items: ThreadNode[] }>(`/api/agents/threads`, {
      params: { rootsOnly: true, status, limit, includeMetrics: true, includeAgentTitles: true },
    }),
  treeRoots: (status: 'open' | 'closed' | 'all' = 'open', limit = 100, depth = 2) =>
    http.get<{ items: ThreadTreeItem[] }>(`/api/agents/threads/tree`, {
      params: {
        status,
        limit,
        depth,
        includeMetrics: true,
        includeAgentTitles: true,
        childrenStatus: status,
      },
    }),
  children: (id: string, status: 'open' | 'closed' | 'all' = 'open') =>
    http.get<{ items: ThreadNode[] }>(`/api/agents/threads/${encodeURIComponent(id)}/children`, {
      params: { status, includeMetrics: true, includeAgentTitles: true },
    }),
  getById: (id: string) =>
    http.get<ThreadNode>(`/api/agents/threads/${encodeURIComponent(id)}`, {
      params: { includeMetrics: true, includeAgentTitles: true },
    }),
  patchStatus: (id: string, status: 'open' | 'closed') =>
    http.patch<void>(`/api/agents/threads/${encodeURIComponent(id)}`, { status }),
  create: ({ agentNodeId, text, parentId, alias }: { agentNodeId: string; text: string; parentId?: string; alias?: string }) => {
    const payload: Record<string, string> = { agentNodeId, text };
    if (parentId !== undefined) payload.parentId = parentId;
    if (alias !== undefined) payload.alias = alias;
    return http.post<{ id: string }>(`/api/agents/threads`, payload);
  },
  sendMessage: (id: string, text: string) =>
    http.post<{ ok: true }>(`/api/agents/threads/${encodeURIComponent(id)}/messages`, { text }),
  metrics: (id: string) =>
    http.get<ThreadMetrics>(`/api/agents/threads/${encodeURIComponent(id)}/metrics`),
  reminders: async (id: string, take: number = 200) => {
    if (!UUID_REGEX.test(id)) {
      throw new Error('Invalid thread identifier');
    }
    const limit = clampTake(take);
    const res = await http.get<{ items: ThreadReminder[] }>(`/api/agents/reminders`, {
      params: { filter: 'active', take: limit, threadId: id },
    });
    const items = [...(res.items || [])];
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { items };
  },
  queuedMessages: (id: string) =>
    http.get<{ items: { id: string; text: string; enqueuedAt?: string }[] }>(
      `/api/agents/threads/${encodeURIComponent(id)}/queued-messages`,
    ),
  clearQueuedMessages: (id: string) =>
    http.delete<{ clearedCount: number }>(`/api/agents/threads/${encodeURIComponent(id)}/queued-messages`),
  cancelThreadReminders: (id: string) =>
    http.post<{ cancelledDb: number; clearedRuntime: number }>(
      `/api/agents/threads/${encodeURIComponent(id)}/reminders/cancel`,
      {},
    ),
};
