import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { chatApi } from '@/api/modules/chat';
import type {
  ChatMessage,
  CreateChatRequest,
  CreateChatResponse,
  GetMessagesResponse,
  MarkAsReadRequest,
  MarkAsReadResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '@/api/types/chat';

type MessagesQueryData = InfiniteData<GetMessagesResponse, string | undefined>;
type SendMessageInput = SendMessageRequest & { optimisticSenderId?: string };

export function useChats(pageSize = 20) {
  return useInfiniteQuery({
    queryKey: ['chat', 'list', pageSize],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => chatApi.getChats({ pageSize, pageToken: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
  });
}

export function useChatMessages(chatId: string | undefined, pageSize = 30) {
  return useInfiniteQuery({
    enabled: !!chatId,
    queryKey: ['chat', 'messages', chatId, pageSize],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      chatApi.getMessages({ chatId: chatId as string, pageSize, pageToken: pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();

  return useMutation<SendMessageResponse, unknown, SendMessageInput, { previous: Array<[unknown[], MessagesQueryData | undefined]>; optimisticId: string }>(
    {
      mutationFn: ({ optimisticSenderId: _optimisticSenderId, ...payload }) => chatApi.sendMessage(payload),
      onMutate: async (variables) => {
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMessage: ChatMessage = {
          id: optimisticId,
          chatId: variables.chatId,
          senderId: variables.optimisticSenderId ?? 'self',
          body: variables.body ?? '',
          fileIds: variables.fileIds ?? [],
          createdAt: new Date().toISOString(),
        };

        const queryKey = ['chat', 'messages', variables.chatId];
        await qc.cancelQueries({ queryKey });
        const previous = qc.getQueriesData<MessagesQueryData>({ queryKey });

        qc.setQueriesData<MessagesQueryData>({ queryKey }, (old) => {
          if (!old || old.pages.length === 0) {
            return {
              pageParams: old?.pageParams.length ? old.pageParams : [undefined],
              pages: [{ messages: [optimisticMessage] }],
            } satisfies MessagesQueryData;
          }
          const [first, ...rest] = old.pages;
          const updatedFirst: GetMessagesResponse = {
            ...first,
            messages: [...first.messages, optimisticMessage],
          };
          return { ...old, pages: [updatedFirst, ...rest] };
        });

        return { previous, optimisticId };
      },
      onError: (_error, variables, context) => {
        if (!context) return;
        const queryKey = ['chat', 'messages', variables.chatId];
        context.previous.forEach(([key, data]) => {
          qc.setQueryData(key, data);
        });
        qc.invalidateQueries({ queryKey }).catch(() => {});
      },
      onSuccess: (data, variables, context) => {
        const queryKey = ['chat', 'messages', variables.chatId];
        qc.setQueriesData<MessagesQueryData>({ queryKey }, (old) => {
          if (!old) return old;
          const pages = old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((message) =>
              message.id === context?.optimisticId ? data.message : message,
            ),
          }));
          return { ...old, pages };
        });
        qc.invalidateQueries({ queryKey: ['chat', 'list'] }).catch(() => {});
      },
      onSettled: (_data, _error, variables) => {
        qc.invalidateQueries({ queryKey: ['chat', 'messages', variables.chatId] }).catch(() => {});
      },
    },
  );
}

export function useCreateChat() {
  const qc = useQueryClient();
  return useMutation<CreateChatResponse, unknown, CreateChatRequest>({
    mutationFn: (payload) => chatApi.createChat(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'list'] }).catch(() => {});
    },
  });
}

export function useMarkAsRead() {
  const qc = useQueryClient();
  return useMutation<MarkAsReadResponse, unknown, MarkAsReadRequest>({
    mutationFn: (payload) => chatApi.markAsRead(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', variables.chatId] }).catch(() => {});
      qc.invalidateQueries({ queryKey: ['chat', 'list'] }).catch(() => {});
    },
  });
}
