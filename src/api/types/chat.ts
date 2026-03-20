export type Chat = {
  id: string;
  participants: ChatParticipant[];
  createdAt: string;
  updatedAt: string;
};

export type ChatParticipant = {
  id: string;
  joinedAt: string;
};

export type ChatMessage = {
  id: string;
  chatId: string;
  senderId: string;
  body: string;
  fileIds: string[];
  createdAt: string;
};

export type CreateChatRequest = { participantIds: string[] };
export type CreateChatResponse = { chat: Chat };

export type GetChatsRequest = { pageSize?: number; pageToken?: string };
export type GetChatsResponse = { chats: Chat[]; nextPageToken?: string };

export type GetMessagesRequest = { chatId: string; pageSize?: number; pageToken?: string };
export type GetMessagesResponse = { messages: ChatMessage[]; nextPageToken?: string; unreadCount?: number };

export type SendMessageRequest = { chatId: string; body?: string; fileIds?: string[] };
export type SendMessageResponse = { message: ChatMessage };

export type MarkAsReadRequest = { chatId: string; messageIds: string[] };
export type MarkAsReadResponse = { readCount: number };
