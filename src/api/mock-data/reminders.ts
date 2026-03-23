import type { ChatReminder } from '@/api/types/chat-resources';
import { iso } from './time';
import { runTwoId } from './runs';
import { conversationOneId } from './conversations';

export const conversationReminders: ChatReminder[] = [
  {
    id: 'reminder-1',
    chatId: conversationOneId,
    note: 'Send the draft to marketing by EOD.',
    at: iso(240),
    createdAt: iso(-120),
    completedAt: null,
    cancelledAt: null,
    runId: runTwoId,
    status: 'scheduled',
  },
];
