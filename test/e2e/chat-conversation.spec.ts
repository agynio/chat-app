import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function openAnyChat(page: Page) {
  await page.goto('/agents/chat');
  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible();

  const firstChat = page.getByTestId('chat-list-item').first();
  await expect(firstChat).toBeVisible();
  await firstChat.click();
  await expect(page).toHaveURL(/\/agents\/chat\//);
}

async function ensureMessages(page: Page) {
  const messages = page.getByTestId('chat-message');
  const currentCount = await messages.count();
  if (currentCount === 0) {
    const input = page.getByTestId('chat-input');
    await expect(input).toBeVisible();
    await input.fill('Hello from the chat tests.');

    const sendButton = page.getByTestId('chat-send-button');
    await expect(sendButton).toBeEnabled();
    await sendButton.click();
  }

  await expect(messages.first()).toBeVisible();
  return messages;
}

test('shows empty state when no chat selected', async ({ page }) => {
  await page.goto('/agents/chat');

  const emptyState = page.getByTestId('chat-conversation-empty');
  await expect(emptyState).toBeVisible();
});

test('displays conversation when chat selected', async ({ page }) => {
  await openAnyChat(page);

  await expect(page.getByTestId('chat-conversation')).toBeVisible();
});

test('displays conversation header', async ({ page }) => {
  await openAnyChat(page);

  const header = page.getByTestId('chat-conversation-header');
  await expect(header).toBeVisible();
  await expect(header).toContainText(/\S+/);
});

test('renders messages', async ({ page }) => {
  await openAnyChat(page);

  const messages = await ensureMessages(page);
  await expect(messages.first()).toBeVisible();
});

test('displays message content', async ({ page }) => {
  await openAnyChat(page);

  const messages = await ensureMessages(page);
  await expect(messages.first()).toContainText(/\S+/);
});
