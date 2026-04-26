import { connectPost } from '@/api/connect';
import type {
  ChatMessage,
  Chat,
  ChatActivityStatus,
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
type ProtoActivityStatus =
  | 'CHAT_ACTIVITY_STATUS_RUNNING'
  | 'CHAT_ACTIVITY_STATUS_PENDING'
  | 'CHAT_ACTIVITY_STATUS_FINISHED'
  | 'CHAT_ACTIVITY_STATUS_UNSPECIFIED';

type ChatWire = Omit<Chat, 'status' | 'activityStatus' | 'unreadCount' | 'activeWorkloadIds'> & {
  status?: ChatStatus | ProtoStatus;
  activityStatus?: ChatActivityStatus | ProtoActivityStatus | null;
  unreadCount?: number;
  activeWorkloadIds?: string[];
};

type UpdateChatRequestWire = Omit<UpdateChatRequest, 'status'> & { status?: ProtoStatus };

function protoStatusToLocal(status?: ChatStatus | ProtoStatus | null): ChatStatus {
  if (!status) return 'open';
  if (status === 'CHAT_STATUS_CLOSED') return 'closed';
  if (status === 'CHAT_STATUS_OPEN') return 'open';
  if (status === 'open' || status === 'closed') return status;
  return 'open';
}

function protoActivityToLocal(status?: ChatActivityStatus | ProtoActivityStatus | null): ChatActivityStatus {
  if (!status || status === 'CHAT_ACTIVITY_STATUS_UNSPECIFIED') return null;
  if (status === 'CHAT_ACTIVITY_STATUS_RUNNING') return 'running';
  if (status === 'CHAT_ACTIVITY_STATUS_PENDING') return 'pending';
  if (status === 'CHAT_ACTIVITY_STATUS_FINISHED') return 'finished';
  if (status === 'running' || status === 'pending' || status === 'finished') return status;
  return null;
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
    activityStatus: protoActivityToLocal(chat.activityStatus),
    unreadCount: chat.unreadCount ?? 0,
    activeWorkloadIds: chat.activeWorkloadIds ?? [],
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
