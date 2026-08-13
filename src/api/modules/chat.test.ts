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

  it('normalizes snake-case organization ids from the chat boundary', async () => {
    mockedConnectPost.mockResolvedValueOnce({
      chats: [
        {
          id: 'chat-1',
          organization_id: 'org-from-wire',
          participants: [],
          createdAt: '2026-05-19T00:00:00Z',
          updatedAt: '2026-05-19T00:00:00Z',
        },
      ],
    });

    const response = await chatApi.getChats({ organizationId: 'org-from-request' });

    expect(response.chats[0]?.organizationId).toBe('org-from-wire');
  });

  it('uses request-scoped organization ids for chat list responses', async () => {
    mockedConnectPost.mockResolvedValueOnce({
      chats: [
        {
          id: 'chat-1',
          participants: [],
          createdAt: '2026-05-19T00:00:00Z',
          updatedAt: '2026-05-19T00:00:00Z',
        },
      ],
    });

    const response = await chatApi.getChats({ organizationId: 'org-from-request' });

    expect(response.chats[0]?.organizationId).toBe('org-from-request');
  });

  it('fails when update responses omit organization ids', async () => {
    mockedConnectPost.mockResolvedValueOnce({
      chat: {
        id: 'chat-1',
        participants: [],
        createdAt: '2026-05-19T00:00:00Z',
        updatedAt: '2026-05-19T00:00:00Z',
      },
    });

    await expect(chatApi.updateChat({ chatId: 'chat-1', status: 'closed' })).rejects.toThrow(
      'Chat chat-1 response missing organizationId.',
    );
  });

  it('deletes chats through ChatGateway', async () => {
    mockedConnectPost.mockResolvedValueOnce({});

    await chatApi.deleteChat({ chatId: 'chat-1' });

    expect(mockedConnectPost).toHaveBeenCalledWith('/api/agynio.api.gateway.v1.ChatGateway', 'DeleteChat', {
      chatId: 'chat-1',
    });
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
