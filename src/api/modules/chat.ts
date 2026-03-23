import { connectPost } from '@/api/connect';
import type {
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
} from '@/api/types/chat';

const CHAT_SERVICE = '/api/agynio.api.gateway.v1.ChatGateway';

export const chatApi = {
  createChat: (req: CreateChatRequest): Promise<CreateChatResponse> =>
    connectPost<CreateChatRequest, CreateChatResponse>(CHAT_SERVICE, 'CreateChat', req),
  getChats: (req: GetChatsRequest): Promise<GetChatsResponse> =>
    connectPost<GetChatsRequest, GetChatsResponse>(CHAT_SERVICE, 'GetChats', req),
  getMessages: (req: GetMessagesRequest): Promise<GetMessagesResponse> =>
    connectPost<GetMessagesRequest, GetMessagesResponse>(CHAT_SERVICE, 'GetMessages', req),
  sendMessage: (req: SendMessageRequest): Promise<SendMessageResponse> =>
    connectPost<SendMessageRequest, SendMessageResponse>(CHAT_SERVICE, 'SendMessage', req),
  markAsRead: (req: MarkAsReadRequest): Promise<MarkAsReadResponse> =>
    connectPost<MarkAsReadRequest, MarkAsReadResponse>(CHAT_SERVICE, 'MarkAsRead', req),
};
