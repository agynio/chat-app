import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createChat, createOrganization } from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

async function expectChatListVisible(page: Page) {
  const list = page.getByTestId('chat-list');
  const emptyState = page.getByText(/No chats (available yet|match the current filter)/);
  await expect(list.or(emptyState)).toBeVisible({ timeout: 15000 });
}

test('renders chat list on load', async ({ page }) => {
  const organizationId = await createOrganization(page, `e2e-org-list-${Date.now()}`);
  await setSelectedOrganization(page, organizationId);
  const chatsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto('/chats');
  const chatsResponse = await chatsLoaded;
  const chatsBody = await chatsResponse.json();
  console.log('[e2e] GetChats response (list load):', JSON.stringify(chatsBody));

  await expectChatListVisible(page);
  await argosScreenshot(page, 'chats-list-loaded');
});

test('participant picker shows available options', async ({ page }) => {
  const organizationId = await createOrganization(page, `e2e-org-picker-${Date.now()}`);
  await setSelectedOrganization(page, organizationId);
  const chatsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto('/chats');
  const chatsResponse = await chatsLoaded;
  const chatsBody = await chatsResponse.json();
  console.log('[e2e] GetChats response (participant picker):', JSON.stringify(chatsBody));

  await expectChatListVisible(page);

  const newChatBtn = page.getByTitle('New chat');
  await expect(newChatBtn).toBeVisible({ timeout: 15000 });
  await newChatBtn.click();

  const autocomplete = page.getByPlaceholder('Search participants...');
  await expect(autocomplete).toBeVisible({ timeout: 15000 });
  await autocomplete.click();

  await page.waitForTimeout(2000);

  await argosScreenshot(page, 'participant-picker-dropdown');
});

test('redirects root to /chats', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/chats$/);
});

test('navigates to chat detail', async ({ page }) => {
  const organizationId = await createOrganization(page, `e2e-org-detail-${Date.now()}`);
  const chatId = await createChat(page, organizationId);
  await setSelectedOrganization(page, organizationId);

  const chatsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto('/chats');
  const chatsResponse = await chatsLoaded;
  const chatsBody = await chatsResponse.json();
  console.log('[e2e] GetChats response (chat detail):', JSON.stringify(chatsBody));

  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible({ timeout: 15000 });

  const firstChat = chatList.locator('.cursor-pointer').first();
  await expect(firstChat).toBeVisible({ timeout: 15000 });
  await firstChat.click();

  await expect(page).toHaveURL(new RegExp(`/chats/${encodeURIComponent(chatId)}`));
  await expect(page.getByTestId('chat')).toBeVisible({ timeout: 15000 });
  await argosScreenshot(page, 'chats-list-detail');
});
