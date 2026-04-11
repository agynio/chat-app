import { connectPost } from '@/api/connect';
import type {
  ChatMessage,
  Chat,
  ChatStatus,
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

type ProtoStatus = 'CHAT_STATUS_OPEN' | 'CHAT_STATUS_CLOSED';

type ChatWire = Omit<Chat, 'status'> & { status?: ChatStatus | ProtoStatus };

type UpdateChatRequestWire = Omit<UpdateChatRequest, 'status'> & { status?: ProtoStatus };

function protoStatusToLocal(status?: ChatStatus | ProtoStatus | null): ChatStatus {
  if (!status) return 'open';
  if (status === 'CHAT_STATUS_CLOSED') return 'closed';
  if (status === 'CHAT_STATUS_OPEN') return 'open';
  if (status === 'open' || status === 'closed') return status;
  return 'open';
}

function localStatusToProto(status?: ChatStatus): ProtoStatus | undefined {
  if (!status) return undefined;
  return status === 'closed' ? 'CHAT_STATUS_CLOSED' : 'CHAT_STATUS_OPEN';
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  return { ...message, fileIds: message.fileIds ?? [] };
}

function normalizeChat(chat: ChatWire): Chat {
  return {
    ...chat,
    participants: chat.participants ?? [],
    status: protoStatusToLocal(chat.status),
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
    const payload: UpdateChatRequestWire = {
      ...req,
      status: localStatusToProto(req.status),
    };
    const resp = await connectPost<UpdateChatRequestWire, UpdateChatResponse>(CHAT_SERVICE, 'UpdateChat', payload);
    return { ...resp, chat: normalizeChat(resp.chat) };
  },
  markAsRead: (req: MarkAsReadRequest): Promise<MarkAsReadResponse> =>
    connectPost<MarkAsReadRequest, MarkAsReadResponse>(CHAT_SERVICE, 'MarkAsRead', req),
};
