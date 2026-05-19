import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();

vi.mock('@/api/http', () => ({
  http: { post },
}));

describe('chatApi chat normalization', () => {
  beforeEach(() => {
    post.mockReset();
  });

  it('normalizes snake-case organization ids from the chat boundary', async () => {
    const { chatApi } = await import('./chat');
    post.mockResolvedValueOnce({
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
    const { chatApi } = await import('./chat');
    post.mockResolvedValueOnce({
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
    const { chatApi } = await import('./chat');
    post.mockResolvedValueOnce({
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
});
