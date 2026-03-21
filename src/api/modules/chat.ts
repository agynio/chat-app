import { http } from '@/api/http';
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

function connectPost<TReq, TRes>(method: string, req: TReq): Promise<TRes> {
  return http.post<TRes>(`${CHAT_SERVICE}/${method}`, req, {
    headers: {
      'Content-Type': 'application/json',
      'Connect-Protocol-Version': '1',
    },
  });
}

export const chatApi = {
  createChat: (req: CreateChatRequest) => connectPost<CreateChatRequest, CreateChatResponse>('CreateChat', req),
  getChats: (req: GetChatsRequest) => connectPost<GetChatsRequest, GetChatsResponse>('GetChats', req),
  getMessages: (req: GetMessagesRequest) => connectPost<GetMessagesRequest, GetMessagesResponse>('GetMessages', req),
  sendMessage: (req: SendMessageRequest) => connectPost<SendMessageRequest, SendMessageResponse>('SendMessage', req),
  markAsRead: (req: MarkAsReadRequest) => connectPost<MarkAsReadRequest, MarkAsReadResponse>('MarkAsRead', req),
};
