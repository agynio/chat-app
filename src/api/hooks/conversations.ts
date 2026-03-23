import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { conversationsApi } from '@/api/modules/conversations';
import type {
  ConversationMessageRecord,
  ConversationStatus,
  CreateConversationRequest,
  CreateConversationResponse,
  GetConversationsResponse,
  GetConversationMessagesResponse,
  SendConversationMessageResponse,
  UpdateConversationStatusResponse,
} from '@/api/types/conversations';

const CONVERSATION_PAGE_SIZE = 25;
const MESSAGE_PAGE_SIZE = 30;

export function useConversations() {
  return useInfiniteQuery({
    queryKey: ['conversations', 'list', CONVERSATION_PAGE_SIZE],
    queryFn: ({ pageParam }) =>
      conversationsApi.getConversations({
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
      conversationsApi.getMessages({
        conversationId: conversationId as string,
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
  conversationId: string;
  body: string;
  senderId: string;
  fileIds?: string[];
};

type SendConversationMessageContext = {
  queryKey: (string | number)[];
  previous?: InfiniteData<GetConversationMessagesResponse>;
  optimisticId: string;
};

export function useSendConversationMessage() {
  const queryClient = useQueryClient();

  return useMutation<SendConversationMessageResponse, Error, SendConversationMessageInput, SendConversationMessageContext>({
    mutationFn: ({ conversationId, body, fileIds, senderId }) =>
      conversationsApi.sendMessage({ conversationId, body, fileIds, senderId }),
    onMutate: async ({ conversationId, body, senderId, fileIds }) => {
      const queryKey = ['conversations', conversationId, 'messages', MESSAGE_PAGE_SIZE];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<GetConversationMessagesResponse>>(queryKey);
      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMessage: ConversationMessageRecord = {
        id: optimisticId,
        conversationId,
        senderId,
        body,
        fileIds: fileIds ?? [],
        createdAt: new Date().toISOString(),
      };

      queryClient.setQueryData<InfiniteData<GetConversationMessagesResponse>>(queryKey, (current) => {
        if (!current) {
          return {
            pageParams: [undefined],
            pages: [{ messages: [optimisticMessage], nextPageToken: undefined, unreadCount: 0 }],
          };
        }
        const [first, ...rest] = current.pages;
        const updatedFirst: GetConversationMessagesResponse = {
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
      const queryKey = context?.queryKey ?? ['conversations', variables.conversationId, 'messages', MESSAGE_PAGE_SIZE];
      queryClient.setQueryData<InfiniteData<GetConversationMessagesResponse>>(queryKey, (current) => {
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

type ToggleConversationStatusInput = {
  conversationId: string;
  status: ConversationStatus;
};

type ToggleConversationStatusContext = {
  queryKey: (string | number)[];
  previous?: InfiniteData<GetConversationsResponse>;
};

export function useToggleConversationStatus() {
  const queryClient = useQueryClient();

  return useMutation<UpdateConversationStatusResponse, Error, ToggleConversationStatusInput, ToggleConversationStatusContext>({
    mutationFn: ({ conversationId, status }) => conversationsApi.updateStatus({ conversationId, status }),
    onMutate: async ({ conversationId, status }) => {
      const queryKey = ['conversations', 'list', CONVERSATION_PAGE_SIZE];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<InfiniteData<GetConversationsResponse>>(queryKey);
      const now = new Date().toISOString();
      queryClient.setQueryData<InfiniteData<GetConversationsResponse>>(queryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((conversation) =>
              conversation.id === conversationId
                ? {
                    ...conversation,
                    status,
                    updatedAt: now,
                  }
                : conversation,
            ),
          })),
        };
      });
      return { queryKey, previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSuccess: (data, _variables, context) => {
      const queryKey = context?.queryKey ?? ['conversations', 'list', CONVERSATION_PAGE_SIZE];
      queryClient.setQueryData<InfiniteData<GetConversationsResponse>>(queryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            conversations: page.conversations.map((conversation) =>
              conversation.id === data.conversation.id ? data.conversation : conversation,
            ),
          })),
        };
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    },
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();

  return useMutation<CreateConversationResponse, Error, CreateConversationRequest>({
    mutationFn: (req) => conversationsApi.createConversation(req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
    },
  });
}

export function useMarkConversationRead(conversationId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageIds: string[]) =>
      conversationsApi.markAsRead({ conversationId: conversationId as string, messageIds }),
    onSuccess: () => {
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversations', conversationId, 'messages'] });
        queryClient.invalidateQueries({ queryKey: ['conversations', 'list'] });
      }
    },
  });
}
