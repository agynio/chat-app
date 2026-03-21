import { test, expect } from './chat-fixtures';
import { waitForChatListState } from './chat-helpers';

test.setTimeout(45000);

test.beforeEach(async ({ page }) => {
  await page.goto('/agents/chat');
  await waitForChatListState(page);
});

test('shows empty state when no chat selected', async ({ page }) => {
  const emptyState = page.getByTestId('chat-conversation-empty');
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText(/Select a chat/i);
});

test('shows conversation shell when no chats', async ({ page }) => {
  await expect(page.getByTestId('chat-conversation')).toBeVisible();
  await expect(page.getByTestId('chat-conversation-empty')).toBeVisible();
});

test('displays conversation header placeholder', async ({ page }) => {
  const header = page.getByTestId('chat-conversation-header');
  await expect(header).toBeVisible();
  await expect(header).toContainText('Select a chat');
  await expect(header).toContainText('Choose a chat to view messages');
});

test('does not render messages without a chat', async ({ page }) => {
  const messages = page.getByTestId('chat-message');

  await expect(messages).toHaveCount(0);
});

test('does not show message content without a chat', async ({ page }) => {
  await expect(page.getByText('No messages yet.')).toHaveCount(0);
  await expect(page.getByTestId('chat-message')).toHaveCount(0);
  await expect(page.getByTestId('chat-conversation-empty')).toBeVisible();
});
