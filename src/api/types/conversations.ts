export type ConversationStatus = 'open' | 'closed';

export type ConversationParticipant = {
  id: string;
  joinedAt: string;
  type?: 'agent' | 'user';
};

export type ConversationSummary = {
  id: string;
  participants: ConversationParticipant[];
  createdAt: string;
  updatedAt: string;
  summary?: string | null;
  status?: ConversationStatus;
  unreadCount?: number;
};

export type ConversationMessageRecord = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  fileIds: string[];
  createdAt: string;
};

export type CreateConversationRequest = { participantIds: string[] };
export type CreateConversationResponse = { conversation: ConversationSummary };

export type GetConversationsRequest = { pageSize?: number; pageToken?: string };
export type GetConversationsResponse = { conversations: ConversationSummary[]; nextPageToken?: string };

export type GetConversationMessagesRequest = { conversationId: string; pageSize?: number; pageToken?: string };
export type GetConversationMessagesResponse = {
  messages: ConversationMessageRecord[];
  nextPageToken?: string;
  unreadCount?: number;
};

export type SendConversationMessageRequest = { conversationId: string; body?: string; fileIds?: string[]; senderId?: string };
export type SendConversationMessageResponse = { message: ConversationMessageRecord };

export type MarkConversationReadRequest = { conversationId: string; messageIds: string[] };
export type MarkConversationReadResponse = { readCount: number };

export type UpdateConversationStatusRequest = { conversationId: string; status: ConversationStatus };
export type UpdateConversationStatusResponse = { conversation: ConversationSummary };
