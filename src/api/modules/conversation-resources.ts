import { conversationReminders } from '@/api/mock-data/reminders';
import { queuedMessagesByConversation } from '@/api/mock-data/messages';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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

export const conversationResources = {
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
