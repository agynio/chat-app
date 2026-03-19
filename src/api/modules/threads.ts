import type { ThreadMetrics, ThreadNode } from '@/api/types/agents';
import { queuedMessagesByThread } from '@/api/mock-data/messages';
import { createId } from '@/api/mock-data/id';
import { reminders } from '@/api/mock-data/reminders';
import { runsByThread } from '@/api/mock-data/runs';
import { childrenByThread, defaultMetrics, threadStore } from '@/api/mock-data/threads';

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

const cloneMetrics = (metrics: ThreadMetrics): ThreadMetrics => ({ ...metrics });

const cloneThread = (thread: ThreadNode): ThreadNode => ({
  ...thread,
  metrics: thread.metrics ? cloneMetrics(thread.metrics) : undefined,
});

const matchesStatus = (status: ThreadNode['status'] | null | undefined, filter: 'open' | 'closed' | 'all') => {
  if (filter === 'all') return true;
  return status === filter;
};

const listRootThreads = (status: 'open' | 'closed' | 'all') =>
  Array.from(threadStore.values()).filter((thread) => !thread.parentId && matchesStatus(thread.status ?? 'open', status));

const getThreadChildren = (threadId: string, status: 'open' | 'closed' | 'all') => {
  const childIds = childrenByThread.get(threadId) ?? [];
  return childIds
    .map((id) => threadStore.get(id))
    .filter((thread): thread is ThreadNode => Boolean(thread))
    .filter((thread) => matchesStatus(thread.status ?? 'open', status));
};

const buildThreadTree = (node: ThreadNode, depth: number, status: 'open' | 'closed' | 'all'): ThreadTreeItem => {
  const childIds = childrenByThread.get(node.id) ?? [];
  const hasChildren = childIds.length > 0;
  if (depth <= 0 || !hasChildren) {
    return { ...cloneThread(node), hasChildren };
  }
  const children = getThreadChildren(node.id, status).map((child) => buildThreadTree(child, depth - 1, status));
  return {
    ...cloneThread(node),
    children: children.length ? children : undefined,
    hasChildren,
  };
};

const resolveQueue = (threadId: string) => {
  const existing = queuedMessagesByThread.get(threadId);
  if (existing) return existing;
  const next: Array<{ id: string; text: string; enqueuedAt?: string }> = [];
  queuedMessagesByThread.set(threadId, next);
  return next;
};

const summarize = (text: string | undefined | null): string => {
  if (!text) return 'New thread';
  const trimmed = text.trim();
  if (!trimmed) return 'New thread';
  return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
};

const sortByCreatedAtDesc = (items: ThreadNode[]) =>
  items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

export const threads = {
  roots: async (status: 'open' | 'closed' | 'all' = 'open', limit = 100) => {
    const items = sortByCreatedAtDesc(listRootThreads(status)).slice(0, Math.max(0, limit));
    return { items: items.map(cloneThread) };
  },
  treeRoots: async (status: 'open' | 'closed' | 'all' = 'open', limit = 100, depth = 2) => {
    const items = sortByCreatedAtDesc(listRootThreads(status)).slice(0, Math.max(0, limit));
    return { items: items.map((thread) => buildThreadTree(thread, depth, status)) };
  },
  children: async (id: string, status: 'open' | 'closed' | 'all' = 'open') => {
    if (!threadStore.has(id)) {
      throw new Error('Thread not found');
    }
    const items = getThreadChildren(id, status).map(cloneThread);
    return { items };
  },
  getById: async (id: string) => {
    const thread = threadStore.get(id);
    if (!thread) {
      throw new Error('Thread not found');
    }
    return cloneThread(thread);
  },
  patchStatus: async (id: string, status: 'open' | 'closed') => {
    const thread = threadStore.get(id);
    if (!thread) {
      throw new Error('Thread not found');
    }
    thread.status = status;
  },
  create: async ({ agentNodeId, text, parentId, alias }: { agentNodeId: string; text: string; parentId?: string; alias?: string }) => {
    const summary = summarize(text);
    const resolvedAlias = alias && alias.trim() ? alias.trim() : summary;
    const now = new Date().toISOString();
    const id = createId();
    const thread: ThreadNode = {
      id,
      alias: resolvedAlias,
      summary,
      status: 'open',
      parentId: parentId ?? null,
      createdAt: now,
      metrics: cloneMetrics(defaultMetrics),
      agentRole: 'Assistant',
      agentName: agentNodeId || 'Chat Agent',
    };
    threadStore.set(id, thread);
    if (parentId) {
      const existing = childrenByThread.get(parentId) ?? [];
      if (!childrenByThread.has(parentId)) {
        childrenByThread.set(parentId, existing);
      }
      existing.unshift(id);
    }
    runsByThread.set(id, []);
    queuedMessagesByThread.set(id, []);
    return { id };
  },
  sendMessage: async (id: string, text: string) => {
    if (!threadStore.has(id)) {
      throw new Error('Thread not found');
    }
    const queue = resolveQueue(id);
    queue.push({ id: createId(), text, enqueuedAt: new Date().toISOString() });
    return { ok: true };
  },
  metrics: async (id: string) => {
    const thread = threadStore.get(id);
    if (!thread) {
      throw new Error('Thread not found');
    }
    return cloneMetrics(thread.metrics ?? defaultMetrics);
  },
  reminders: async (id: string, take: number = 200) => {
    if (!UUID_REGEX.test(id)) {
      throw new Error('Invalid thread identifier');
    }
    const limit = clampTake(take);
    const items = reminders
      .filter((reminder) => reminder.threadId === id)
      .filter((reminder) => reminder.cancelledAt === null && reminder.completedAt === null)
      .slice(0, limit)
      .map((reminder) => ({ ...reminder }));
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { items };
  },
  queuedMessages: async (id: string) => {
    const queue = resolveQueue(id);
    return { items: queue.map((item) => ({ ...item })) };
  },
  clearQueuedMessages: async (id: string) => {
    const queue = resolveQueue(id);
    const clearedCount = queue.length;
    queue.splice(0, queue.length);
    return { clearedCount };
  },
  cancelThreadReminders: async (id: string) => {
    const now = new Date().toISOString();
    let cancelledDb = 0;
    for (const reminder of reminders) {
      if (reminder.threadId !== id) continue;
      if (reminder.cancelledAt !== null || reminder.completedAt !== null) continue;
      reminder.cancelledAt = now;
      reminder.status = 'cancelled';
      cancelledDb += 1;
    }
    return { cancelledDb, clearedRuntime: 0 };
  },
};
