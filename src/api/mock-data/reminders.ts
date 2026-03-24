import type { ChatReminder } from '@/api/types/chat-resources';
import { iso } from './time';
import { runTwoId } from './runs';
import { chatOneId } from './chats';

export const chatReminders: ChatReminder[] = [
  {
    id: 'reminder-1',
    chatId: chatOneId,
    note: 'Send the draft to marketing by EOD.',
    at: iso(240),
    createdAt: iso(-120),
    completedAt: null,
    cancelledAt: null,
    runId: runTwoId,
    status: 'scheduled',
  },
];
