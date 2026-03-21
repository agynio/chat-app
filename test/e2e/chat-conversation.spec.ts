import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { openAnyChat } from './chat-helpers';

async function waitForMessagesOrEmptyState(page: Page) {
  const messages = page.getByTestId('chat-message');
  const emptyState = page.getByText('No messages yet.');

  await expect
    .poll(async () => {
      const count = await messages.count();
      if (count > 0) {
        return 'messages';
      }
      return (await emptyState.isVisible()) ? 'empty' : 'loading';
    })
    .not.toBe('loading');
  return { messages, emptyState };
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

  const { messages, emptyState } = await waitForMessagesOrEmptyState(page);
  const count = await messages.count();

  if (count > 0) {
    await expect(messages.first()).toBeVisible();
  } else {
    await expect(emptyState).toBeVisible();
  }
});

test('displays message content', async ({ page }) => {
  await openAnyChat(page);

  const { messages, emptyState } = await waitForMessagesOrEmptyState(page);
  const count = await messages.count();

  if (count > 0) {
    await expect(messages.first()).toContainText(/\S+/);
  } else {
    await expect(emptyState).toBeVisible();
  }
});
