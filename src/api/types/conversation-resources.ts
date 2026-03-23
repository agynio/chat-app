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

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ConversationActivity = 'working' | 'waiting' | 'idle';

export type RunMeta = {
  id: string;
  conversationId: string;
  status: 'running' | 'finished' | 'terminated';
  createdAt: string;
  updatedAt: string;
};

export type RunMessageItem = {
  id: string;
  kind: 'user' | 'assistant' | 'system' | 'tool';
  text?: string | null;
  source: JsonValue;
  createdAt: string;
};
