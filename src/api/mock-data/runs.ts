import type { RunMeta } from '@/api/types/agents';
import { iso } from './time';
import { threadOneId, threadTwoId, threadThreeId } from './threads';

export const runOneId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const runTwoId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const runThreeId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

export const runsByThread = new Map<string, RunMeta[]>([
  [
    threadOneId,
    [
      {
        id: runOneId,
        threadId: threadOneId,
        status: 'finished',
        createdAt: iso(-160),
        updatedAt: iso(-150),
      },
      {
        id: runTwoId,
        threadId: threadOneId,
        status: 'running',
        createdAt: iso(-20),
        updatedAt: iso(-2),
      },
    ],
  ],
  [
    threadTwoId,
    [
      {
        id: runThreeId,
        threadId: threadTwoId,
        status: 'finished',
        createdAt: iso(-380),
        updatedAt: iso(-360),
      },
    ],
  ],
  [threadThreeId, []],
]);
