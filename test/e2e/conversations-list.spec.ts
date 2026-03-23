import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createChat } from './chat-api';

async function expectConversationsListVisible(page: Page) {
  const list = page.getByTestId('conversations-list');
  const emptyState = page.getByText(/No conversations (available yet|match the current filter)/);
  await expect(list.or(emptyState)).toBeVisible({ timeout: 5000 });
}

test('renders conversation list on load', async ({ page }) => {
  await page.goto('/conversations');

  await expectConversationsListVisible(page);
  await argosScreenshot(page, 'conversations-list-loaded');
});

test('redirects root to /conversations', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/conversations$/);
});

test('navigates to conversation detail', async ({ page }) => {
  const chatId = await createChat(page.context());

  await page.goto('/conversations');

  const conversationsList = page.getByTestId('conversations-list');
  await expect(conversationsList).toBeVisible();

  const firstConversation = conversationsList.locator('.cursor-pointer').first();
  await expect(firstConversation).toBeVisible();
  await firstConversation.click();

  await expect(page).toHaveURL(new RegExp(`/conversations/${chatId}`));
  await expect(page.getByTestId('conversation')).toBeVisible();
  await argosScreenshot(page, 'conversations-list-detail');
});
