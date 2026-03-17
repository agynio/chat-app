export type ThreadStatus = 'open' | 'closed';

export type ThreadMetrics = {
  remindersCount: number;
  containersCount: number;
  activity: 'working' | 'waiting' | 'idle';
  runsCount: number;
};

export type ThreadReminder = {
  id: string;
  threadId: string;
  note: string;
  at: string;
  createdAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  runId?: string | null;
  status?: 'scheduled' | 'executed' | 'cancelled';
};

export type ReminderItem = ThreadReminder;

export type ThreadNode = {
  id: string;
  alias: string;
  summary?: string | null;
  status?: ThreadStatus;
  parentId?: string | null;
  createdAt: string;
  metrics?: ThreadMetrics;
  agentRole?: string;
  agentName?: string;
};

export type RunMeta = {
  id: string;
  threadId: string;
  status: 'running' | 'finished' | 'terminated';
  createdAt: string;
  updatedAt: string;
};

export type RunMessageItem = { id: string; kind: 'user' | 'assistant' | 'system' | 'tool'; text?: string | null; source: unknown; createdAt: string };
