import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { chatMessagesPageSize, chatMessagesQueryKey, type ChatMessagesQueryKey } from './chat-query-keys';
import type { GetMessagesResponse } from '@/api/types/chat';

function message(id: string, chatId: string) {
  return {
    id,
    chatId,
    senderId: 'user-1',
    body: id,
    fileIds: [],
    createdAt: `2026-05-13T00:00:${id.padStart(2, '0')}Z`,
  };
}

async function fetchMessagesPage(queryKey: ChatMessagesQueryKey, pageToken?: string): Promise<GetMessagesResponse> {
  return getMessages({ chatId: queryKey[1], pageSize: pageSizeFromKey(queryKey), pageToken });
}

const pageSizeFromKey = chatMessagesPageSize;

const getMessages = vi.fn<
  (request: { chatId: string; pageSize: number; pageToken?: string }) => Promise<GetMessagesResponse>
>();

describe('chat message pagination cache', () => {
  it('uses separate cache keys for each chat thread', () => {
    expect(chatMessagesQueryKey('thread-a')).not.toEqual(chatMessagesQueryKey('thread-b'));
  });

  it('keeps pagination cursors isolated by thread', async () => {
    const client = new QueryClient();
    getMessages.mockImplementation(async (request) => {
      if (request.chatId === 'thread-a') {
        return {
          messages: [message(`a-${request.pageToken ?? 'first'}`, request.chatId)],
          nextPageToken: request.pageToken ? undefined : 'thread-a-page-2',
          unreadCount: 0,
        };
      }

      return {
        messages: [message(`b-${request.pageToken ?? 'first'}`, request.chatId)],
        nextPageToken: request.pageToken ? undefined : 'thread-b-page-2',
        unreadCount: 0,
      };
    });

    const threadAKey = chatMessagesQueryKey('thread-a');
    const threadBKey = chatMessagesQueryKey('thread-b');

    await client.fetchInfiniteQuery({
      queryKey: threadAKey,
      queryFn: ({ pageParam }) => fetchMessagesPage(threadAKey, pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    });

    await client.fetchInfiniteQuery({
      queryKey: threadBKey,
      queryFn: ({ pageParam }) => fetchMessagesPage(threadBKey, pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    });

    await client.fetchInfiniteQuery({
      queryKey: threadAKey,
      queryFn: ({ pageParam }) => fetchMessagesPage(threadAKey, pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
      pages: 2,
    });

    const threadAData = client.getQueryData<InfiniteData<GetMessagesResponse>>(threadAKey);
    const threadBData = client.getQueryData<InfiniteData<GetMessagesResponse>>(threadBKey);

    expect(threadAData?.pages).toHaveLength(2);
    expect(threadAData?.pages[1]?.messages[0]?.id).toBe('a-thread-a-page-2');
    expect(threadBData?.pages).toHaveLength(1);
    expect(threadBData?.pages[0]?.nextPageToken).toBe('thread-b-page-2');

    expect(getMessages).toHaveBeenNthCalledWith(1, {
      chatId: 'thread-a',
      pageSize: pageSizeFromKey(threadAKey),
      pageToken: undefined,
    });
    expect(getMessages).toHaveBeenNthCalledWith(2, {
      chatId: 'thread-b',
      pageSize: pageSizeFromKey(threadBKey),
      pageToken: undefined,
    });
    expect(getMessages).toHaveBeenNthCalledWith(3, {
      chatId: 'thread-a',
      pageSize: pageSizeFromKey(threadAKey),
      pageToken: undefined,
    });
    expect(getMessages).toHaveBeenNthCalledWith(4, {
      chatId: 'thread-a',
      pageSize: pageSizeFromKey(threadAKey),
      pageToken: 'thread-a-page-2',
    });

    getMessages.mockReset();
  });
});
