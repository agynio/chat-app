import { queuedMessagesByChat } from '@/api/mock-data/messages';
import { chatReminders } from '@/api/mock-data/reminders';
import type { ChatActivity } from '@/api/types/chat-resources';
import { UUID_REGEX } from '@/utils/validation';

const clampTake = (value: number | undefined, fallback = 200) => {
  if (!Number.isFinite(value)) return fallback;
  const coerced = Math.trunc(value as number);
  return Math.min(1000, Math.max(1, coerced));
};

const resolveQueue = (chatId: string) => {
  const existing = queuedMessagesByChat.get(chatId);
  if (existing) return existing;
  const next: Array<{ id: string; text: string; enqueuedAt?: string }> = [];
  queuedMessagesByChat.set(chatId, next);
  return next;
};

const resolveActivity = (chatId: string): ChatActivity => {
  const queued = queuedMessagesByChat.get(chatId) ?? [];
  if (queued.length > 0) return 'pending';
  return 'finished';
};

export const chatResources = {
  activity: async (chatId: string) => {
    if (!UUID_REGEX.test(chatId)) {
      throw new Error('Invalid chat identifier');
    }
    return resolveActivity(chatId);
  },
  reminders: async (chatId: string, take: number = 200) => {
    if (!UUID_REGEX.test(chatId)) {
      throw new Error('Invalid chat identifier');
    }
    const limit = clampTake(take);
    const items = chatReminders
      .filter((reminder) => reminder.chatId === chatId)
      .filter((reminder) => reminder.cancelledAt === null && reminder.completedAt === null)
      .slice(0, limit)
      .map((reminder) => ({ ...reminder }));
    items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    return { items };
  },
  queuedMessages: async (chatId: string) => {
    const queue = resolveQueue(chatId);
    return { items: queue.map((item) => ({ ...item })) };
  },
  clearQueuedMessages: async (chatId: string) => {
    const queue = resolveQueue(chatId);
    const clearedCount = queue.length;
    queue.splice(0, queue.length);
    return { clearedCount };
  },
};
