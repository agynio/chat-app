import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatApi } from '@/api/modules/chat';
import type { GetMessagesResponse } from '@/api/types/chat';
import { fetchChatMessagesPage, MESSAGE_ORDER_NEWEST_FIRST, MESSAGE_PAGE_SIZE } from './chat';

vi.mock('@/api/modules/chat', () => ({
  chatApi: {
    getThreadMessages: vi.fn(),
    getMessages: vi.fn(),
  },
}));

const mockedChatApi = vi.mocked(chatApi);

describe('fetchChatMessagesPage', () => {
  beforeEach(() => {
    mockedChatApi.getThreadMessages.mockReset();
    mockedChatApi.getMessages.mockReset();
  });

  it('requests newest messages first and gets unread metadata for the initial page', async () => {
    mockedChatApi.getThreadMessages.mockResolvedValueOnce({
      messages: [
        {
          id: 'message-30',
          chatId: 'thread-1',
          senderId: 'user-1',
          body: 'newest',
          fileIds: [],
          createdAt: '2026-05-22T12:30:00Z',
        },
      ],
      nextPageToken: 'older-page',
    });
    mockedChatApi.getMessages.mockResolvedValueOnce({ messages: [], unreadCount: 3 });

    const page = await fetchChatMessagesPage('thread-1');

    expect(mockedChatApi.getThreadMessages).toHaveBeenCalledWith({
      threadId: 'thread-1',
      pageSize: MESSAGE_PAGE_SIZE,
      pageToken: undefined,
      order: MESSAGE_ORDER_NEWEST_FIRST,
    });
    expect(mockedChatApi.getMessages).toHaveBeenCalledWith({ chatId: 'thread-1', pageSize: 1 });
    expect(page.unreadCount).toBe(3);
    expect(page.nextPageToken).toBe('older-page');
  });

  it('uses the newest-first cursor for older history pages without refetching metadata', async () => {
    mockedChatApi.getThreadMessages.mockResolvedValueOnce({
      messages: [
        {
          id: 'message-29',
          chatId: 'thread-1',
          senderId: 'user-1',
          body: 'older',
          fileIds: [],
          createdAt: '2026-05-22T12:29:00Z',
        },
      ],
    });

    await fetchChatMessagesPage('thread-1', 'older-page');

    expect(mockedChatApi.getThreadMessages).toHaveBeenCalledWith({
      threadId: 'thread-1',
      pageSize: MESSAGE_PAGE_SIZE,
      pageToken: 'older-page',
      order: MESSAGE_ORDER_NEWEST_FIRST,
    });
    expect(mockedChatApi.getMessages).not.toHaveBeenCalled();
  });
});


describe('chat message pagination cache', () => {
  it('uses separate cache keys for each chat thread', async () => {
    const client = new QueryClient();
    mockedChatApi.getThreadMessages.mockImplementation(async (request) => ({
      messages: [
        {
          id: `${request.threadId}-${request.pageToken ?? 'first'}`,
          chatId: request.threadId,
          senderId: 'user-1',
          body: 'message',
          fileIds: [],
          createdAt: '2026-05-22T12:30:00Z',
        },
      ],
      nextPageToken: request.pageToken ? undefined : `${request.threadId}-page-2`,
    }));
    mockedChatApi.getMessages.mockResolvedValue({ messages: [], unreadCount: 0 });

    const threadAKey = ['chats', 'thread-a', 'messages', MESSAGE_PAGE_SIZE];
    const threadBKey = ['chats', 'thread-b', 'messages', MESSAGE_PAGE_SIZE];

    await client.fetchInfiniteQuery({
      queryKey: threadAKey,
      queryFn: ({ pageParam }) => fetchChatMessagesPage('thread-a', pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    });

    await client.fetchInfiniteQuery({
      queryKey: threadBKey,
      queryFn: ({ pageParam }) => fetchChatMessagesPage('thread-b', pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    });

    await client.fetchInfiniteQuery({
      queryKey: threadAKey,
      queryFn: ({ pageParam }) => fetchChatMessagesPage('thread-a', pageParam),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
      pages: 2,
    });

    const threadAData = client.getQueryData<InfiniteData<GetMessagesResponse>>(threadAKey);
    const threadBData = client.getQueryData<InfiniteData<GetMessagesResponse>>(threadBKey);

    expect(threadAData?.pages).toHaveLength(2);
    expect(threadAData?.pages[1]?.messages[0]?.id).toBe('thread-a-thread-a-page-2');
    expect(threadBData?.pages).toHaveLength(1);
    expect(threadBData?.pages[0]?.nextPageToken).toBe('thread-b-page-2');
  });
});
