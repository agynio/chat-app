export type ChatReminder = {
  id: string;
  chatId: string;
  note: string;
  at: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  runId?: string | null;
  status?: 'scheduled' | 'executed' | 'cancelled';
};

export type ReminderItem = ChatReminder;

export type ChatActivity = 'working' | 'waiting' | 'idle';
