import { connectPost } from '@/api/connect';
import type {
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

export const conversationsApi = {
  createConversation: (req: CreateConversationRequest) =>
    connectPost<CreateConversationRequest, CreateConversationResponse>(CHAT_SERVICE, 'CreateChat', req),
  getConversations: (req: GetConversationsRequest) =>
    connectPost<GetConversationsRequest, GetConversationsResponse>(CHAT_SERVICE, 'GetChats', req),
  getMessages: (req: GetConversationMessagesRequest) =>
    connectPost<GetConversationMessagesRequest, GetConversationMessagesResponse>(CHAT_SERVICE, 'GetMessages', req),
  sendMessage: (req: SendConversationMessageRequest) =>
    connectPost<SendConversationMessageRequest, SendConversationMessageResponse>(CHAT_SERVICE, 'SendMessage', req),
  markAsRead: (req: MarkConversationReadRequest) =>
    connectPost<MarkConversationReadRequest, MarkConversationReadResponse>(CHAT_SERVICE, 'MarkAsRead', req),
  updateStatus: (req: UpdateConversationStatusRequest) =>
    connectPost<UpdateConversationStatusRequest, UpdateConversationStatusResponse>(CHAT_SERVICE, 'UpdateChatStatus', req),
};
