import { http } from '@/api/http';
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
} from '@/api/types/conversations';

const CHAT_SERVICE = '/api/agynio.api.gateway.v1.ChatGateway';

function connectPost<TReq, TRes>(method: string, req: TReq): Promise<TRes> {
  return http.post<TRes>(`${CHAT_SERVICE}/${method}`, req, {
    headers: {
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
    },
  });
}

export const conversationsApi = {
  createConversation: (req: CreateConversationRequest) =>
    connectPost<CreateConversationRequest, CreateConversationResponse>('CreateChat', req),
  getConversations: (req: GetConversationsRequest) =>
    connectPost<GetConversationsRequest, GetConversationsResponse>('GetChats', req),
  getMessages: (req: GetConversationMessagesRequest) =>
    connectPost<GetConversationMessagesRequest, GetConversationMessagesResponse>('GetMessages', req),
  sendMessage: (req: SendConversationMessageRequest) =>
    connectPost<SendConversationMessageRequest, SendConversationMessageResponse>('SendMessage', req),
  markAsRead: (req: MarkConversationReadRequest) =>
    connectPost<MarkConversationReadRequest, MarkConversationReadResponse>('MarkAsRead', req),
};
