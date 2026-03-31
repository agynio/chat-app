import { connectPost } from '@/api/connect';
import { readChatOrganizationMap, writeChatOrganization } from '@/utils/chatOrganizationStorage';
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

type ChatWire = Omit<Chat, 'organizationId'> & { organization_id?: string; organizationId?: string };
type CreateChatRequestWire = Omit<CreateChatRequest, 'organizationId'> & { organization_id: string };
type GetChatsRequestWire = Omit<GetChatsRequest, 'organizationId'> & { organization_id: string };

function normalizeChat(chat: ChatWire): Chat {
  const { organization_id: organizationIdWire, organizationId, participants, ...rest } = chat;
  return {
    ...rest,
    organizationId: organizationId ?? organizationIdWire ?? '',
    participants: participants ?? [],
  };
}

function serializeCreateChatRequest(req: CreateChatRequest): CreateChatRequestWire {
  const { organizationId, ...rest } = req;
  return { ...rest, organization_id: organizationId };
}

function serializeGetChatsRequest(req: GetChatsRequest): GetChatsRequestWire {
  const { organizationId, ...rest } = req;
  return { ...rest, organization_id: organizationId };
}

export const chatApi = {
  createChat: async (req: CreateChatRequest): Promise<CreateChatResponse> => {
    const resp = await connectPost<CreateChatRequestWire, CreateChatResponse>(
      CHAT_SERVICE,
      'CreateChat',
      serializeCreateChatRequest(req),
    );
    const normalizedChat = normalizeChat(resp.chat);
    const chatWithOrganization = normalizedChat.organizationId
      ? normalizedChat
      : {
          ...normalizedChat,
          organizationId: req.organizationId,
        };
    writeChatOrganization(chatWithOrganization.id, req.organizationId);
    return {
      ...resp,
      chat: chatWithOrganization,
    };
  },
  getChats: async (req: GetChatsRequest): Promise<GetChatsResponse> => {
    const resp = await connectPost<GetChatsRequestWire, GetChatsResponse>(
      CHAT_SERVICE,
      'GetChats',
      serializeGetChatsRequest(req),
    );
    const chatOrganizationMap = readChatOrganizationMap();
    const chats = (resp.chats ?? []).map((chat) => {
      const normalized = normalizeChat(chat);
      if (normalized.organizationId) return normalized;
      const mappedOrganizationId = chatOrganizationMap[normalized.id];
      if (!mappedOrganizationId) return normalized;
      return {
        ...normalized,
        organizationId: mappedOrganizationId,
      };
    });
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
