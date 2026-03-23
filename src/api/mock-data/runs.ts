import type { RunMeta } from '@/api/types/conversation-resources';
import { iso } from './time';
import { conversationOneId, conversationTwoId, conversationThreeId } from './conversations';

export const runOneId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const runTwoId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const runThreeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

export const runsByConversation = new Map<string, RunMeta[]>([
  [
    conversationOneId,
    [
      {
        id: runOneId,
        conversationId: conversationOneId,
        status: 'finished',
        createdAt: iso(-160),
        updatedAt: iso(-150),
      },
      {
        id: runTwoId,
        conversationId: conversationOneId,
        status: 'running',
        createdAt: iso(-20),
        updatedAt: iso(-2),
      },
    ],
  ],
  [
    conversationTwoId,
    [
      {
        id: runThreeId,
        conversationId: conversationTwoId,
        status: 'finished',
        createdAt: iso(-380),
        updatedAt: iso(-360),
      },
    ],
  ],
  [conversationThreeId, []],
]);
