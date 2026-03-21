import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export async function openAnyChat(page: Page) {
  await page.goto('/agents/chat');
  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible();

  const firstChat = page.getByTestId('chat-list-item').first();
  await expect(firstChat).toBeVisible();
  await firstChat.click();
  await expect(page).toHaveURL(/\/agents\/chat\//);
}
