import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { chatApi } from '@/api/modules/chat';
import type {
  Chat,
  ChatStatus,
  ChatMessage,
  CreateChatRequest,
  CreateChatResponse,
  GetChatsResponse,
  GetMessagesResponse,
  SendMessageResponse,
  UpdateChatResponse,
} from '@/api/types/chat';
import { graphSocket } from '@/lib/graph/socket';

const CHAT_PAGE_SIZE = 25;
const MESSAGE_PAGE_SIZE = 30;
const MESSAGE_POLL_INTERVAL_MS = 5000;

export function useChats(organizationId: string | undefined) {
  return useInfiniteQuery({
    enabled: Boolean(organizationId),
    queryKey: ['chats', 'list', organizationId, CHAT_PAGE_SIZE],
    queryFn: ({ pageParam }) =>
      chatApi.getChats({
        organizationId: organizationId as string,
        pageSize: CHAT_PAGE_SIZE,
        pageToken: pageParam ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    staleTime: 15000,
    refetchOnWindowFocus: false,
  });
}

export function useChatMessages(chatId: string | null | undefined) {
  const queryKey = ['chats', chatId ?? 'none', 'messages', MESSAGE_PAGE_SIZE] as const;

  return useInfiniteQuery({
    enabled: Boolean(chatId),
    queryKey,
    queryFn: ({ pageParam }) =>
      chatApi.getMessages({
        chatId: chatId as string,
        pageSize: MESSAGE_PAGE_SIZE,
        pageToken: pageParam ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    staleTime: 5000,
    refetchOnWindowFocus: false,
    refetchInterval: () => (graphSocket.isConnected() ? false : MESSAGE_POLL_INTERVAL_MS),
    refetchIntervalInBackground: true,
  });
}

type SendMessageInput = {
  chatId: string;
  body: string;
  senderId: string;
  fileIds?: string[];
};

type SendMessageContext = {
  queryKey: (string | number)[];
  previous?: InfiniteData<GetMessagesResponse>;
  optimisticId: string;
};

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResponse, Error, SendMessageInput, SendMessageContext>({
    mutationFn: ({ chatId, body, fileIds }) =>
      chatApi.sendMessage({ chatId, body, fileIds }),
    onMutate: async ({ chatId, body, senderId, fileIds }) => {
      const queryKey = ['chats', chatId, 'messages', MESSAGE_PAGE_SIZE];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<GetMessagesResponse>>(queryKey);
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        chatId,
        senderId,
        body,
        fileIds: fileIds ?? [],
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<InfiniteData<GetMessagesResponse>>(queryKey, (current) => {
        if (!current) {
          return {
            pageParams: [undefined],
            pages: [{ messages: [optimisticMessage], nextPageToken: undefined, unreadCount: 0 }],
          };
        }
        const [first, ...rest] = current.pages;
        const updatedFirst: GetMessagesResponse = {
          ...first,
          messages: [...(first.messages ?? []), optimisticMessage],
        };
        return { ...current, pages: [updatedFirst, ...rest] };
      });

      return { queryKey, previous, optimisticId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSuccess: (data, variables, context) => {
      const queryKey = context?.queryKey ?? ['chats', variables.chatId, 'messages', MESSAGE_PAGE_SIZE];
      queryClient.setQueryData<InfiniteData<GetMessagesResponse>>(queryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            messages: (page.messages ?? []).map((message) =>
              message.id === context?.optimisticId ? data.message : message,
            ),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
    },
  });
}

type CreateChatInput = Omit<CreateChatRequest, 'organizationId'>;

export function useCreateChat(organizationId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation<CreateChatResponse, Error, CreateChatInput>({
    mutationFn: (req) => {
      if (!organizationId) {
        throw new Error('Organization is required to create a chat.');
      }
      return chatApi.createChat({ ...req, organizationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', 'list', organizationId] });
    },
  });
}

type UpdateChatInput = {
  chatId: string;
  status?: ChatStatus;
  summary?: string;
};

type UpdateChatContext = {
  previousChats: Array<[unknown, InfiniteData<GetChatsResponse> | undefined]>;
};

const updateChatPages = (
  current: InfiniteData<GetChatsResponse> | undefined,
  chatId: string,
  updates: Partial<Chat>,
): InfiniteData<GetChatsResponse> | undefined => {
  if (!current) return current;
  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      chats: page.chats.map((chat) => (chat.id === chatId ? { ...chat, ...updates } : chat)),
    })),
  };
};

export function useUpdateChat() {
  const queryClient = useQueryClient();

  return useMutation<UpdateChatResponse, Error, UpdateChatInput, UpdateChatContext>({
    mutationFn: ({ chatId, status, summary }) =>
      chatApi.updateChat({ chatId, status, summary }),
    onMutate: async ({ chatId, status, summary }) => {
      const queryKey = ['chats', 'list'];
      await queryClient.cancelQueries({ queryKey });
      const previousChats = queryClient.getQueriesData<InfiniteData<GetChatsResponse>>({ queryKey });
      const updates: Partial<Chat> = {
        ...(status !== undefined ? { status } : {}),
        ...(summary !== undefined ? { summary } : {}),
      };
      queryClient.setQueriesData<InfiniteData<GetChatsResponse>>({ queryKey }, (current) =>
        updateChatPages(current, chatId, updates),
      );
      return { previousChats };
    },
    onError: (_error, _variables, context) => {
      context?.previousChats.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (data, variables) => {
      const queryKey = ['chats', 'list'];
      queryClient.setQueriesData<InfiniteData<GetChatsResponse>>({ queryKey }, (current) =>
        updateChatPages(current, variables.chatId, data.chat),
      );
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useMarkAsRead(chatId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageIds: string[]) =>
      chatApi.markAsRead({ chatId: chatId as string, messageIds }),
    onSuccess: () => {
      if (chatId) {
        queryClient.invalidateQueries({ queryKey: ['chats', chatId, 'messages'] });
        queryClient.invalidateQueries({ queryKey: ['chats', 'list'] });
      }
    },
  });
}
