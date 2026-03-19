import type { ThreadReminder } from '@/api/types/agents';
import { iso } from './time';
import { runTwoId } from './runs';
import { threadOneId } from './threads';

export const reminders: ThreadReminder[] = [
  {
    id: 'reminder-1',
    threadId: threadOneId,
    note: 'Send the draft to marketing by EOD.',
    at: iso(240),
    createdAt: iso(-120),
    completedAt: null,
    cancelledAt: null,
    runId: runTwoId,
    status: 'scheduled',
  },
];
