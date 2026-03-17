import type { ConversationMessage } from '@/components/Conversation';
import type { RunMeta, ThreadNode } from '@/api/types/agents';

export type ThreadChildrenEntry = {
  nodes: ThreadNode[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string | null;
  hasChildren: boolean;
};

export type ThreadChildrenState = Record<string, ThreadChildrenEntry>;

export type ThreadDraft = {
  id: string;
  agentNodeId?: string;
  agentName?: string;
  inputValue: string;
  createdAt: string;
};

export type AgentOption = { id: string; name: string; graphTitle?: string };

export type ConversationMessageWithMeta = ConversationMessage & { createdAtRaw: string };

export type ScrollState = {
  atBottom: boolean;
  dFromBottom: number;
  lastScrollTop: number;
  lastMeasured: number;
};

export type ThreadViewCacheEntry = {
  threadId: string;
  runs: RunMeta[];
  runMessagesByRunId: Record<string, ConversationMessageWithMeta[]>;
  scroll: ScrollState | null;
  messagesLoaded: boolean;
  updatedAt: number;
};
