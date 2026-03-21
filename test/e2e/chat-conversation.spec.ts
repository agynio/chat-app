import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { openAnyChat } from './chat-helpers';

test.setTimeout(45000);

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
    }, { timeout: 30000 })
    .not.toBe('loading');
  return { messages, emptyState };
}

test('shows empty state when no chat selected', async ({ page }) => {
  await page.goto('/agents/chat');

  const emptyState = page.getByTestId('chat-conversation-empty');
  await expect(emptyState).toBeVisible();
});

test('displays conversation when chat selected', async ({ page }) => {
  const hasChat = await openAnyChat(page);

  await expect(page.getByTestId('chat-conversation')).toBeVisible();
  if (!hasChat) {
    await expect(page.getByTestId('chat-conversation-empty')).toBeVisible();
  }
});

test('displays conversation header', async ({ page }) => {
  const hasChat = await openAnyChat(page);

  const header = page.getByTestId('chat-conversation-header');
  await expect(header).toBeVisible();
  if (!hasChat) {
    await expect(header).toContainText('Select a chat');
    return;
  }

  await expect(header).toContainText(/\S+/);
});

test('renders messages', async ({ page }) => {
  const hasChat = await openAnyChat(page);

  if (!hasChat) {
    await expect(page.getByTestId('chat-conversation-empty')).toBeVisible();
    return;
  }

  const { messages, emptyState } = await waitForMessagesOrEmptyState(page);
  const count = await messages.count();

  if (count > 0) {
    await expect(messages.first()).toBeVisible();
  } else {
    await expect(emptyState).toBeVisible();
  }
});

test('displays message content', async ({ page }) => {
  const hasChat = await openAnyChat(page);

  if (!hasChat) {
    await expect(page.getByTestId('chat-conversation-empty')).toBeVisible();
    return;
  }

  const { messages, emptyState } = await waitForMessagesOrEmptyState(page);
  const count = await messages.count();

  if (count > 0) {
    await expect(messages.first()).toContainText(/\S+/);
  } else {
    await expect(emptyState).toBeVisible();
  }
});
