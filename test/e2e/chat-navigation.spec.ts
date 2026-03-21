import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { waitForChatListState } from './chat-helpers';

function chatNavButton(page: Page) {
  return page.getByTestId('sidebar-nav-chat');
}

test('navigates to chat via sidebar', async ({ page }) => {
  await page.goto('/agents/threads');

  const chatButton = chatNavButton(page);
  await expect(chatButton).toBeVisible();
  await chatButton.click();

  await expect(page).toHaveURL(/\/agents\/chat$/);
});

test('navigates to chat via direct URL', async ({ page }) => {
  await page.goto('/agents/chat');

  const { chatList, emptyState, count } = await waitForChatListState(page);
  if (count === 0) {
    await expect(emptyState).toBeVisible();
    return;
  }

  await expect(chatList).toBeVisible();
});

test('sidebar shows Chat as active', async ({ page }) => {
  await page.goto('/agents/chat');

  const chatButton = chatNavButton(page);
  await expect(chatButton).toBeVisible();
  await expect(chatButton).toHaveAttribute('aria-current', 'page');
});
