import type { RunMeta } from '@/api/types/chat-resources';
import { iso } from './time';
import { chatOneId, chatTwoId, chatThreeId } from './chats';

export const runOneId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const runTwoId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const runThreeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

export const runsByChat = new Map<string, RunMeta[]>([
  [
    chatOneId,
    [
      {
        id: runOneId,
        chatId: chatOneId,
        status: 'finished',
        createdAt: iso(-160),
        updatedAt: iso(-150),
      },
      {
        id: runTwoId,
        chatId: chatOneId,
        status: 'running',
        createdAt: iso(-20),
        updatedAt: iso(-2),
      },
    ],
  ],
  [
    chatTwoId,
    [
      {
        id: runThreeId,
        chatId: chatTwoId,
        status: 'finished',
        createdAt: iso(-380),
        updatedAt: iso(-360),
      },
    ],
  ],
  [chatThreeId, []],
]);
