import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './chat-fixtures';
import { waitForChatListState } from './chat-helpers';

test.setTimeout(45000);

function chatNavButton(page: Page) {
  return page.getByTestId('sidebar-nav-agentsChat');
}

test('navigates to chat via sidebar', async ({ page }) => {
  await page.goto('/agents/threads');

  const chatButton = chatNavButton(page);
  await expect(chatButton).toBeVisible();
  await chatButton.click();

  await expect(page).toHaveURL(/\/agents\/chat$/);
  const { list } = await waitForChatListState(page);
  await expect(list).toBeVisible();
  await argosScreenshot(page, 'chat-navigation-sidebar');
});

test('navigates to chat via direct URL', async ({ page, chatSeed }) => {
  await page.goto('/agents/chat');

  const { list, count } = await waitForChatListState(page);
  await expect(list).toBeVisible();
  expect(count).toBe(chatSeed.chats.length);
  await argosScreenshot(page, 'chat-navigation-direct');
});

test('sidebar shows Chat as active', async ({ page }) => {
  await page.goto('/agents/chat');

  const chatButton = chatNavButton(page);
  await expect(chatButton).toBeVisible();
  await expect(chatButton).toHaveAttribute('aria-current', 'page');
  await argosScreenshot(page, 'chat-navigation-active');
});
