export type ConversationReminder = {
  id: string;
  conversationId: string;
  note: string;
  at: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  runId?: string | null;
  status?: 'scheduled' | 'executed' | 'cancelled';
};

export type ReminderItem = ConversationReminder;

export type RunMeta = {
  id: string;
  conversationId: string;
  status: 'running' | 'finished' | 'terminated';
  createdAt: string;
  updatedAt: string;
};

export type RunMessageItem = { id: string; kind: 'user' | 'assistant' | 'system' | 'tool'; text?: string | null; source: unknown; createdAt: string };
