import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatApi } from '@/api/modules/chat';
import type { Chat, GetMessagesResponse } from '@/api/types/chat';
import {
  fetchChatMessagesPage,
  MESSAGE_ORDER_NEWEST_FIRST,
  MESSAGE_PAGE_SIZE,
  useCreateChat,
  useDeleteChat,
} from './chat';

vi.mock('@/api/modules/chat', () => ({
  chatApi: {
    getThreadMessages: vi.fn(),
    getMessages: vi.fn(),
    createChat: vi.fn(),
    deleteChat: vi.fn(),
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


describe('useCreateChat', () => {
  it('invalidates agent instances so the instance minted for the new thread resolves', async () => {
    const chat: Chat = {
      id: 'thread-1',
      organizationId: 'org-1',
      participants: [{ id: 'instance-1', joinedAt: '2026-05-22T12:30:00Z' }],
      createdAt: '2026-05-22T12:30:00Z',
      updatedAt: '2026-05-22T12:30:00Z',
      status: 'open',
      summary: null,
      activityStatus: null,
      unreadCount: 0,
      activeWorkloadIds: [],
    };
    mockedChatApi.createChat.mockResolvedValueOnce({ chat });

    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidateQueries = vi.spyOn(client, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useCreateChat('org-1'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ participantIds: ['agent-1'] });
    });

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['chats', 'list', 'org-1'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['agent-instances'] });
  });
});

describe('useDeleteChat', () => {
  const chat = (id: string): Chat => ({
    id,
    organizationId: 'org-1',
    participants: [],
    createdAt: '2026-08-13T12:00:00Z',
    updatedAt: '2026-08-13T12:00:00Z',
    status: 'open',
    summary: null,
    activityStatus: null,
    unreadCount: 0,
    activeWorkloadIds: [],
  });

  const listKey = ['chats', 'list', 'org-1', 25];

  const seedList = (client: QueryClient) => {
    client.setQueryData<InfiniteData<GetChatsResponse>>(listKey, {
      pageParams: [undefined],
      pages: [{ chats: [chat('thread-1'), chat('thread-2')] }],
    });
    return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
  };

  const listedIds = (client: QueryClient) =>
    client
      .getQueryData<InfiniteData<GetChatsResponse>>(listKey)
      ?.pages.flatMap((page) => page.chats.map((entry) => entry.id));

  beforeEach(() => {
    mockedChatApi.deleteChat.mockReset();
  });

  it('drops the deleted chat from every cached list page', async () => {
    mockedChatApi.deleteChat.mockResolvedValueOnce({});
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = seedList(client);

    const { result } = renderHook(() => useDeleteChat(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ chatId: 'thread-1' });
    });

    expect(mockedChatApi.deleteChat).toHaveBeenCalledWith({ chatId: 'thread-1' });
    expect(listedIds(client)).toEqual(['thread-2']);
  });

  it('puts the chat back when the delete fails', async () => {
    mockedChatApi.deleteChat.mockRejectedValueOnce(new Error('nope'));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = seedList(client);

    const { result } = renderHook(() => useDeleteChat(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ chatId: 'thread-1' }).catch(() => {});
    });

    expect(listedIds(client)).toEqual(['thread-1', 'thread-2']);
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
