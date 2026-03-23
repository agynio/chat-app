import type { RunMessageItem, RunMeta } from '@/api/types/chat-resources';
import { runMessagesByRunId } from '@/api/mock-data/messages';
import { runsByChat } from '@/api/mock-data/runs';

const cloneRun = (run: RunMeta): RunMeta => ({ ...run });

const cloneMessage = (message: RunMessageItem): RunMessageItem => ({
  ...message,
  source: structuredClone(message.source),
});

export const runs = {
  listByChat: async (chatId: string) => {
    const items = runsByChat.get(chatId) ?? [];
    return { items: items.map(cloneRun) };
  },
  messages: async (runId: string, type: 'input' | 'injected' | 'output') => {
    const bucket = runMessagesByRunId.get(runId);
    const items = bucket ? bucket[type] : [];
    return { items: items.map(cloneMessage) };
  },
};
