import type { Page } from '@playwright/test';
import { expect } from './fixtures';

/**
 * Intercept chat gateway API calls and return empty but valid responses.
 * The gateway service is not available in the e2e cluster.
 */
export async function mockChatApi(page: Page) {
  await page.route(/agynio\.api\.gateway\.v1\.ChatGateway/, async (route) => {
    const url = route.request().url();
    const now = new Date().toISOString();

    if (url.includes('GetChats')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ chats: [], nextPageToken: '' }),
      });
      return;
    }

    if (url.includes('GetMessages')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ messages: [], nextPageToken: '' }),
      });
      return;
    }

    if (url.includes('SendMessage')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            id: 'mock-message-1',
            chatId: 'mock-chat',
            senderId: 'mock-user',
            body: '',
            fileIds: [],
            createdAt: now,
          },
        }),
      });
      return;
    }

    if (url.includes('CreateChat')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          chat: {
            id: 'mock-chat',
            participants: [],
            createdAt: now,
            updatedAt: now,
          },
        }),
      });
      return;
    }

    if (url.includes('MarkAsRead')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ readCount: 0 }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

export async function waitForChatListState(page: Page) {
  const emptyState = page.getByTestId('chat-list-empty');

  await expect
    .poll(async () => {
      const itemCount = await page.getByTestId('chat-list-item').count();
      if (itemCount > 0) return 'list';
      if (await emptyState.isVisible()) return 'empty';
      return 'loading';
    }, { timeout: 15000 })
    .not.toBe('loading');

  const count = await page.getByTestId('chat-list-item').count();
  return { emptyState, count };
}

export async function openAnyChat(page: Page) {
  await page.goto('/agents/chat');
  const { emptyState, count } = await waitForChatListState(page);

  if (count === 0) {
    await expect(emptyState).toBeVisible();
    return false;
  }

  const firstChat = page.getByTestId('chat-list-item').first();
  await expect(firstChat).toBeVisible();
  await firstChat.click();
  await expect(page).toHaveURL(/\/agents\/chat\//);
  return true;
}
