import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createChat } from './chat-api';

async function expectChatListVisible(page: Page) {
  const list = page.getByTestId('chat-list');
  const emptyState = page.getByText(/No chats (available yet|match the current filter)/);
  await expect(list.or(emptyState)).toBeVisible({ timeout: 5000 });
}

test('renders chat list on load', async ({ page }) => {
  await page.goto('/chats');

  await expectChatListVisible(page);
  await argosScreenshot(page, 'chats-list-loaded');
});

test('participant picker shows available options', async ({ page }) => {
  const agentsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('ListAgents') && resp.status() === 200,
    { timeout: 15000 },
  );

  await page.goto('/chats');

  await expectChatListVisible(page);
  await agentsLoaded;

  const newChatBtn = page.getByTitle('New chat');
  await expect(newChatBtn).toBeVisible({ timeout: 15000 });
  await newChatBtn.click();

  const autocomplete = page.getByPlaceholder('Search participants...');
  await expect(autocomplete).toBeVisible({ timeout: 15000 });
  await autocomplete.click();

  const dropdownOption = autocomplete.locator('..').locator('button[data-highlighted]').first();
  await expect(dropdownOption).toBeVisible({ timeout: 15000 });

  await argosScreenshot(page, 'participant-picker-dropdown');
});

test('redirects root to /chats', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/chats$/);
});

test('navigates to chat detail', async ({ page }) => {
  const chatId = await createChat(page);

  await page.goto('/chats');

  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible();

  const firstChat = chatList.locator('.cursor-pointer').first();
  await expect(firstChat).toBeVisible();
  await firstChat.click();

  await expect(page).toHaveURL(new RegExp(`/chats/${chatId}`));
  await expect(page.getByTestId('chat')).toBeVisible({ timeout: 15000 });
  await argosScreenshot(page, 'chats-list-detail');
});
