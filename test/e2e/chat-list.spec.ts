import { test, expect } from './chat-fixtures';
import { waitForChatListState } from './chat-helpers';

test.setTimeout(45000);

test.beforeEach(async ({ page }) => {
  await page.goto('/agents/chat');
});

test('renders empty chat list on load', async ({ page }) => {
  const { emptyState, count } = await waitForChatListState(page);

  expect(count).toBe(0);
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText(/No chats found/i);
});

test('does not render chat list items when empty', async ({ page }) => {
  const { count } = await waitForChatListState(page);

  expect(count).toBe(0);
  await expect(page.getByTestId('chat-list-item')).toHaveCount(0);
});

test('shows zero conversations in header when empty', async ({ page }) => {
  await waitForChatListState(page);

  await expect(page.getByText('0 conversations')).toBeVisible();
});

test('does not show selected chat indicator when empty', async ({ page }) => {
  await waitForChatListState(page);

  await expect(page.getByTestId('chat-list-item-selected-indicator')).toHaveCount(0);
});

test('shows empty state message when no chats', async ({ page }) => {
  const { emptyState } = await waitForChatListState(page);

  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText(/No chats found/i);
  await expect(emptyState).not.toContainText(/Unable to load chats/i);
});
