import type { ConversationReminder } from '@/api/types/conversation-resources';
import { iso } from './time';
import { runTwoId } from './runs';
import { conversationOneId } from './conversations';

export const conversationReminders: ConversationReminder[] = [
  {
    id: 'reminder-1',
    conversationId: conversationOneId,
    note: 'Send the draft to marketing by EOD.',
    at: iso(240),
    createdAt: iso(-120),
    completedAt: null,
    cancelledAt: null,
    runId: runTwoId,
    status: 'scheduled',
  },
];
