import { connectPost } from '@/api/connect';
import type {
  ConversationMessageRecord,
  ConversationSummary,
  CreateConversationRequest,
  CreateConversationResponse,
  GetConversationsRequest,
  GetConversationsResponse,
  GetConversationMessagesRequest,
  GetConversationMessagesResponse,
  MarkConversationReadRequest,
  MarkConversationReadResponse,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  UpdateConversationStatusRequest,
  UpdateConversationStatusResponse,
} from '@/api/types/conversations';

const CHAT_SERVICE = '/api/agynio.api.gateway.v1.ChatGateway';

type ChatMessageRecord = Omit<ConversationMessageRecord, 'conversationId'> & { chatId: string };
type GetChatsResponseWire = { chats: ConversationSummary[]; nextPageToken?: string };
type GetMessagesRequestWire = { chatId: string; pageSize?: number; pageToken?: string };
type GetMessagesResponseWire = { messages: ChatMessageRecord[]; nextPageToken?: string; unreadCount?: number };
type SendMessageRequestWire = { chatId: string; body?: string; fileIds?: string[] };
type SendMessageResponseWire = { message: ChatMessageRecord };
type CreateConversationResponseWire = { chat: ConversationSummary };
type UpdateConversationStatusResponseWire = { chat: ConversationSummary };
type MarkConversationReadRequestWire = { chatId: string; messageIds: string[] };
type UpdateConversationStatusRequestWire = { chatId: string; status: UpdateConversationStatusRequest['status'] };

function mapChatMessage(message: ChatMessageRecord): ConversationMessageRecord {
  if (typeof message.chatId !== 'string' || message.chatId.length === 0) {
    throw new Error('Invalid chat message payload');
  }
  const { chatId, ...rest } = message;
  return { ...rest, conversationId: chatId };
}

function mapConversationResponse(chat: ConversationSummary): ConversationSummary {
  if (!chat?.id || typeof chat.id !== 'string') {
    throw new Error('Invalid chat payload');
  }
  return chat;
}

export const conversationsApi = {
  createConversation: async (req: CreateConversationRequest): Promise<CreateConversationResponse> => {
    const response = await connectPost<CreateConversationRequest, CreateConversationResponseWire>(
      CHAT_SERVICE,
      'CreateChat',
      req,
    );
    return { conversation: mapConversationResponse(response.chat) };
  },
  getConversations: async (req: GetConversationsRequest): Promise<GetConversationsResponse> => {
    const response = await connectPost<GetConversationsRequest, GetChatsResponseWire>(CHAT_SERVICE, 'GetChats', req);
    if (!Array.isArray(response.chats)) {
      throw new Error('Invalid chats response');
    }
    return {
      conversations: response.chats.map(mapConversationResponse),
      nextPageToken: response.nextPageToken,
    };
  },
  getMessages: async (req: GetConversationMessagesRequest): Promise<GetConversationMessagesResponse> => {
    const response = await connectPost<GetMessagesRequestWire, GetMessagesResponseWire>(
      CHAT_SERVICE,
      'GetMessages',
      {
        chatId: req.conversationId,
        pageSize: req.pageSize,
        pageToken: req.pageToken,
      },
    );
    if (!Array.isArray(response.messages)) {
      throw new Error('Invalid messages response');
    }
    return {
      messages: response.messages.map(mapChatMessage),
      nextPageToken: response.nextPageToken,
      unreadCount: response.unreadCount,
    };
  },
  sendMessage: async (req: SendConversationMessageRequest): Promise<SendConversationMessageResponse> => {
    const response = await connectPost<SendMessageRequestWire, SendMessageResponseWire>(
      CHAT_SERVICE,
      'SendMessage',
      {
        chatId: req.conversationId,
        body: req.body,
        fileIds: req.fileIds,
      },
    );
    return { message: mapChatMessage(response.message) };
  },
  markAsRead: (req: MarkConversationReadRequest): Promise<MarkConversationReadResponse> =>
    connectPost<MarkConversationReadRequestWire, MarkConversationReadResponse>(CHAT_SERVICE, 'MarkAsRead', {
      chatId: req.conversationId,
      messageIds: req.messageIds,
    }),
  updateStatus: async (req: UpdateConversationStatusRequest): Promise<UpdateConversationStatusResponse> => {
    const response = await connectPost<UpdateConversationStatusRequestWire, UpdateConversationStatusResponseWire>(
      CHAT_SERVICE,
      'UpdateChatStatus',
      {
        chatId: req.conversationId,
        status: req.status,
      },
    );
    return { conversation: mapConversationResponse(response.chat) };
  },
};
