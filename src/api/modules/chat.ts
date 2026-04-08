import { connectPost } from '@/api/connect';
import type {
  ChatMessage,
  Chat,
  CreateChatRequest,
  CreateChatResponse,
  GetChatsRequest,
  GetChatsResponse,
  GetMessagesRequest,
  GetMessagesResponse,
  MarkAsReadRequest,
  MarkAsReadResponse,
  SendMessageRequest,
  SendMessageResponse,
  UpdateChatRequest,
  UpdateChatResponse,
} from '@/api/types/chat';

const CHAT_SERVICE = '/api/agynio.api.gateway.v1.ChatGateway';

function normalizeMessage(message: ChatMessage): ChatMessage {
  return { ...message, fileIds: message.fileIds ?? [] };
}

function normalizeChat(chat: Chat): Chat {
  return {
    ...chat,
    participants: chat.participants ?? [],
    status: chat.status ?? 'open',
    summary: chat.summary ?? null,
  };
}

export const chatApi = {
  createChat: async (req: CreateChatRequest): Promise<CreateChatResponse> => {
    const resp = await connectPost<CreateChatRequest, CreateChatResponse>(CHAT_SERVICE, 'CreateChat', req);
    return { ...resp, chat: normalizeChat(resp.chat) };
  },
  getChats: async (req: GetChatsRequest): Promise<GetChatsResponse> => {
    const resp = await connectPost<GetChatsRequest, GetChatsResponse>(CHAT_SERVICE, 'GetChats', req);
    return {
      ...resp,
      chats: (resp.chats ?? []).map(normalizeChat),
    };
  },
  getMessages: async (req: GetMessagesRequest): Promise<GetMessagesResponse> => {
    const resp = await connectPost<GetMessagesRequest, GetMessagesResponse>(CHAT_SERVICE, 'GetMessages', req);
    return {
      ...resp,
      messages: (resp.messages ?? []).map(normalizeMessage),
    };
  },
  sendMessage: async (req: SendMessageRequest): Promise<SendMessageResponse> => {
    const resp = await connectPost<SendMessageRequest, SendMessageResponse>(CHAT_SERVICE, 'SendMessage', req);
    return {
      ...resp,
      message: normalizeMessage(resp.message),
    };
  },
  updateChat: async (req: UpdateChatRequest): Promise<UpdateChatResponse> => {
    const resp = await connectPost<UpdateChatRequest, UpdateChatResponse>(CHAT_SERVICE, 'UpdateChat', req);
    return { ...resp, chat: normalizeChat(resp.chat) };
  },
  markAsRead: (req: MarkAsReadRequest): Promise<MarkAsReadResponse> =>
    connectPost<MarkAsReadRequest, MarkAsReadResponse>(CHAT_SERVICE, 'MarkAsRead', req),
};
