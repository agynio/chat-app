import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export async function waitForChatListState(page: Page) {
  const chatList = page.getByTestId('chat-list');
  const emptyState = page.getByTestId('chat-list-empty');

  await expect
    .poll(async () => {
      const itemCount = await page.getByTestId('chat-list-item').count();
      if (itemCount > 0) return 'list';
      if (await emptyState.isVisible()) return 'empty';
      return 'loading';
    }, { timeout: 30000 })
    .not.toBe('loading');

  const count = await page.getByTestId('chat-list-item').count();
  return { chatList, emptyState, count };
}

export async function openAnyChat(page: Page) {
  await page.goto('/agents/chat');
  const { chatList, emptyState, count } = await waitForChatListState(page);

  if (count === 0) {
    await expect(emptyState).toBeVisible();
    return false;
  }

  await expect(chatList).toBeVisible();
  const firstChat = page.getByTestId('chat-list-item').first();
  await expect(firstChat).toBeVisible();
  await firstChat.click();
  await expect(page).toHaveURL(/\/agents\/chat\//);
  return true;
}
