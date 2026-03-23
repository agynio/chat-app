import type { RunMessageItem, RunMeta } from '@/api/types/conversation-resources';
import { runMessagesByRunId } from '@/api/mock-data/messages';
import { runsByConversation } from '@/api/mock-data/runs';

const cloneRun = (run: RunMeta): RunMeta => ({ ...run });

const cloneMessage = (message: RunMessageItem): RunMessageItem => ({
  ...message,
  source: structuredClone(message.source),
});

export const runs = {
  listByConversation: async (conversationId: string) => {
    const items = runsByConversation.get(conversationId) ?? [];
    return { items: items.map(cloneRun) };
  },
  messages: async (runId: string, type: 'input' | 'injected' | 'output') => {
    const bucket = runMessagesByRunId.get(runId);
    const items = bucket ? bucket[type] : [];
    return { items: items.map(cloneMessage) };
  },
};
