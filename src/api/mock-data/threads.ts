import type { ThreadMetrics, ThreadNode } from '@/api/types/agents';
import { iso } from './time';

export const threadOneId = '11111111-1111-1111-1111-111111111111';
export const threadTwoId = '22222222-2222-2222-2222-222222222222';
export const threadThreeId = '33333333-3333-3333-3333-333333333333';

export const defaultMetrics: ThreadMetrics = {
  remindersCount: 0,
  containersCount: 0,
  activity: 'idle',
  runsCount: 0,
};

export const threadStore = new Map<string, ThreadNode>([
  [
    threadOneId,
    {
      id: threadOneId,
      alias: 'Q2 campaign brief',
      summary: 'Draft a Q2 marketing brief for the launch campaign.',
      status: 'open',
      parentId: null,
      createdAt: iso(-180),
      metrics: {
        remindersCount: 1,
        containersCount: 1,
        activity: 'waiting',
        runsCount: 2,
      },
      agentRole: 'Assistant',
      agentName: 'Campaign Planner',
    },
  ],
  [
    threadTwoId,
    {
      id: threadTwoId,
      alias: 'Customer follow-up',
      summary: 'Draft a follow-up note for the ACME renewal.',
      status: 'closed',
      parentId: null,
      createdAt: iso(-420),
      metrics: {
        remindersCount: 0,
        containersCount: 0,
        activity: 'idle',
        runsCount: 1,
      },
      agentRole: 'Assistant',
      agentName: 'Account Concierge',
    },
  ],
  [
    threadThreeId,
    {
      id: threadThreeId,
      alias: 'Q2 brief review',
      summary: 'Review edits and finalize the Q2 campaign outline.',
      status: 'open',
      parentId: threadOneId,
      createdAt: iso(-90),
      metrics: {
        remindersCount: 0,
        containersCount: 0,
        activity: 'working',
        runsCount: 1,
      },
      agentRole: 'Assistant',
      agentName: 'Campaign Planner',
    },
  ],
]);

export const childrenByThread = new Map<string, string[]>([[threadOneId, [threadThreeId]]]);
