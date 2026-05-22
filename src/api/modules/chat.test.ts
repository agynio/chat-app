import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatApi } from './chat';
import { connectPost } from '@/api/connect';

vi.mock('@/api/connect', () => ({
  connectPost: vi.fn(),
}));

const mockedConnectPost = vi.mocked(connectPost);

describe('chatApi', () => {
  beforeEach(() => {
    mockedConnectPost.mockReset();
  });

  it('loads thread messages through ThreadsGateway with newest-first ordering', async () => {
    mockedConnectPost.mockResolvedValueOnce({
      messages: [
        {
          id: 'message-2',
          threadId: 'thread-1',
          senderId: 'user-1',
          body: 'latest',
          createdAt: '2026-05-22T12:01:00Z',
        },
      ],
      nextPageToken: 'older-page',
    });

    const response = await chatApi.getThreadMessages({
      threadId: 'thread-1',
      pageSize: 30,
      pageToken: 'cursor-1',
      order: 'MESSAGE_ORDER_NEWEST_FIRST',
    });

    expect(mockedConnectPost).toHaveBeenCalledWith(
      '/api/agynio.api.gateway.v1.ThreadsGateway',
      'GetMessages',
      {
        threadId: 'thread-1',
        pageSize: 30,
        pageToken: 'cursor-1',
        order: 'MESSAGE_ORDER_NEWEST_FIRST',
      },
    );
    expect(response).toEqual({
      messages: [
        {
          id: 'message-2',
          chatId: 'thread-1',
          senderId: 'user-1',
          body: 'latest',
          fileIds: [],
          createdAt: '2026-05-22T12:01:00Z',
        },
      ],
      nextPageToken: 'older-page',
    });
  });
});
