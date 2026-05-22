import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatApi } from '@/api/modules/chat';
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
