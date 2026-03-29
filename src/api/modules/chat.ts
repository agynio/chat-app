import { connectPost } from '@/api/connect';
import type {
  Chat,
  ChatMessage,
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

function normalizeMessage(message: ChatMessage): ChatMessage {
  return { ...message, fileIds: message.fileIds ?? [] };
}

type ChatWire = Omit<Chat, 'organizationId'> & { organization_id?: string };
type CreateChatRequestWire = CreateChatRequest & { organization_id: string };
type GetChatsRequestWire = GetChatsRequest & { organization_id: string };

function normalizeChat(chat: ChatWire): Chat {
  const { organization_id: organizationId, participants, ...rest } = chat;
  if (!organizationId) {
    throw new Error('Chat response missing organization_id.');
  }
  return {
    ...rest,
    organizationId,
    participants: participants ?? [],
  };
}

function serializeCreateChatRequest(req: CreateChatRequest): CreateChatRequestWire {
  return { ...req, organization_id: req.organizationId };
}

function serializeGetChatsRequest(req: GetChatsRequest): GetChatsRequestWire {
  return { ...req, organization_id: req.organizationId };
}

export const chatApi = {
  createChat: async (req: CreateChatRequest): Promise<CreateChatResponse> => {
    const resp = await connectPost<CreateChatRequestWire, CreateChatResponse>(
      CHAT_SERVICE,
      'CreateChat',
      serializeCreateChatRequest(req),
    );
    if (!resp.chat) {
      throw new Error('CreateChat response missing chat.');
    }
    const normalizedChat = normalizeChat(resp.chat);
    return {
      ...resp,
      chat: normalizedChat,
    };
  },
  getChats: async (req: GetChatsRequest): Promise<GetChatsResponse> => {
    const resp = await connectPost<GetChatsRequestWire, GetChatsResponse>(
      CHAT_SERVICE,
      'GetChats',
      serializeGetChatsRequest(req),
    );
    const chats = (resp.chats ?? []).map(normalizeChat);
    return {
      ...resp,
      chats,
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
  markAsRead: (req: MarkAsReadRequest): Promise<MarkAsReadResponse> =>
    connectPost<MarkAsReadRequest, MarkAsReadResponse>(CHAT_SERVICE, 'MarkAsRead', req),
};
