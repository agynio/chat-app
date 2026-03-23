import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { chatApi } from '@/api/modules/chat';
import type {
  ChatMessage,
  CreateChatRequest,
  CreateChatResponse,
  GetMessagesResponse,
  SendMessageResponse,
} from '@/api/types/chat';

const CONVERSATION_PAGE_SIZE = 25;
const MESSAGE_PAGE_SIZE = 30;

export function useConversations() {
  return useInfiniteQuery({
    queryKey: ['conversations', 'list', CONVERSATION_PAGE_SIZE],
    queryFn: ({ pageParam }) =>
      chatApi.getChats({
        pageSize: CONVERSATION_PAGE_SIZE,
        pageToken: pageParam ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    staleTime: 15000,
    refetchOnWindowFocus: false,
  });
}

export function useConversationMessages(conversationId: string | null | undefined) {
  return useInfiniteQuery({
    enabled: Boolean(conversationId),
    queryKey: ['conversations', conversationId ?? 'none', 'messages', MESSAGE_PAGE_SIZE],
    queryFn: ({ pageParam }) =>
      chatApi.getMessages({
        chatId: conversationId as string,
        pageSize: MESSAGE_PAGE_SIZE,
        pageToken: pageParam ?? undefined,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    staleTime: 5000,
    refetchOnWindowFocus: false,
  });
}

type SendConversationMessageInput = {
  chatId: string;
  body: string;
  senderId: string;
  fileIds?: string[];
};

type SendConversationMessageContext = {
  queryKey: (string | number)[];
  previous?: InfiniteData<GetMessagesResponse>;
  optimisticId: string;
};

export function useSendConversationMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendMessageResponse, Error, SendConversationMessageInput, SendConversationMessageContext>({
    mutationFn: ({ chatId, body, fileIds }) =>
      chatApi.sendMessage({ chatId, body, fileIds }),
    onMutate: async ({ chatId, body, senderId, fileIds }) => {
      const queryKey = ['conversations', chatId, 'messages', MESSAGE_PAGE_SIZE];
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
          messages: [...first.messages, optimisticMessage],
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
      const queryKey = context?.queryKey ?? ['conversations', variables.chatId, 'messages', MESSAGE_PAGE_SIZE];
      queryClient.setQueryData<InfiniteData<GetMessagesResponse>>(queryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            messages: page.messages.map((message) =>
              message.id === context?.optimisticId ? data.message : message,
            ),
          })),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation<CreateChatResponse, Error, CreateChatRequest>({
    mutationFn: (req) => chatApi.createChat(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    },
  });
}

export function useMarkConversationRead(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageIds: string[]) =>
      chatApi.markAsRead({ chatId: conversationId as string, messageIds }),
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });
        queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
      }
    },
  });
}
