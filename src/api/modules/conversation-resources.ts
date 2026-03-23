import { queuedMessagesByConversation } from '@/api/mock-data/messages';
import { conversationReminders } from '@/api/mock-data/reminders';
import { runsByConversation } from '@/api/mock-data/runs';
import type { ConversationActivity } from '@/api/types/conversation-resources';
import { UUID_REGEX } from '@/utils/validation';

const clampTake = (value: number | undefined, fallback = 200) => {
  if (!Number.isFinite(value)) return fallback;
  const coerced = Math.trunc(value as number);
  return Math.min(1000, Math.max(1, coerced));
};

const resolveQueue = (conversationId: string) => {
  const existing = queuedMessagesByConversation.get(conversationId);
  if (existing) return existing;
  const next: Array<{ id: string; text: string; enqueuedAt?: string }> = [];
  queuedMessagesByConversation.set(conversationId, next);
  return next;
};

const resolveActivity = (conversationId: string): ConversationActivity => {
  const runs = runsByConversation.get(conversationId) ?? [];
  if (runs.some((run) => run.status === 'running')) return 'working';
  const queued = queuedMessagesByConversation.get(conversationId) ?? [];
  if (queued.length > 0) return 'waiting';
  return 'idle';
};

export const conversationResources = {
  activity: async (conversationId: string) => {
    if (!UUID_REGEX.test(conversationId)) {
      throw new Error('Invalid conversation identifier');
    }
    return resolveActivity(conversationId);
  },
  reminders: async (conversationId: string, take: number = 200) => {
    if (!UUID_REGEX.test(conversationId)) {
      throw new Error('Invalid conversation identifier');
    }
    const limit = clampTake(take);
    const items = conversationReminders
      .filter((reminder) => reminder.conversationId === conversationId)
      .filter((reminder) => reminder.cancelledAt === null && reminder.completedAt === null)
      .slice(0, limit)
      .map((reminder) => ({ ...reminder }));
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { items };
  },
  queuedMessages: async (conversationId: string) => {
    const queue = resolveQueue(conversationId);
    return { items: queue.map((item) => ({ ...item })) };
  },
  clearQueuedMessages: async (conversationId: string) => {
    const queue = resolveQueue(conversationId);
    const clearedCount = queue.length;
    queue.splice(0, queue.length);
    return { clearedCount };
  },
};
