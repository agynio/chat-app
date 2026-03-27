import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import * as crypto from 'node:crypto';
import { test, expect } from './multi-user-fixtures';
import { createAgent, createChat, createOrganization, resolveIdentityId } from './chat-api';

async function expectChatListVisible(page: Page) {
  const list = page.getByTestId('chat-list');
  const emptyState = page.getByText(/No chats (available yet|match the current filter)/);
  await expect(list.or(emptyState)).toBeVisible({ timeout: 5000 });
}

test('renders chat list on load', async ({ userAPage }) => {
  await userAPage.goto('/chats');

  await expectChatListVisible(userAPage);
  await argosScreenshot(userAPage, 'chats-list-loaded');
});

test('participant picker shows available options', async ({ userAPage }) => {
  const now = Date.now();
  const organizationId = await createOrganization(userAPage, `e2e-org-picker-${now}`);
  const agentName = `e2e-agent-picker-${now}`;
  await createAgent(userAPage, {
    organizationId,
    name: agentName,
    role: 'assistant',
    model: crypto.randomUUID(),
    description: 'E2E participant picker agent',
    configuration: '{}',
    image: 'agent-image:latest',
  });

  await userAPage.goto('/chats');

  await expectChatListVisible(userAPage);

  const newChatBtn = userAPage.getByTitle('New chat');
  await expect(newChatBtn).toBeVisible({ timeout: 15000 });
  await newChatBtn.click();

  const autocomplete = userAPage.getByPlaceholder('Search participants...');
  await expect(autocomplete).toBeVisible({ timeout: 15000 });
  await autocomplete.click();

  await expect(userAPage.getByRole('option', { name: agentName })).toBeVisible({ timeout: 15000 });

  await argosScreenshot(userAPage, 'participant-picker-dropdown');
});

test('redirects root to /chats', async ({ userAPage }) => {
  await userAPage.goto('/');

  await expect(userAPage).toHaveURL(/\/chats$/);
});

test('navigates to chat detail', async ({ userAPage, userBPage }) => {
  const userBId = await resolveIdentityId(userBPage);
  const chatId = await createChat(userAPage, userBId);

  await userAPage.goto('/chats');

  const chatList = userAPage.getByTestId('chat-list');
  await expect(chatList).toBeVisible();

  const firstChat = chatList.locator('.cursor-pointer').first();
  await expect(firstChat).toBeVisible();
  await firstChat.click();

  await expect(userAPage).toHaveURL(new RegExp(`/chats/${chatId}`));
  await expect(userAPage.getByTestId('chat')).toBeVisible({ timeout: 15000 });
  await argosScreenshot(userAPage, 'chats-list-detail');
});
