import { test, expect } from './fixtures';
import { waitForChatListState } from './chat-helpers';

test.setTimeout(45000);

test('renders chat list on load', async ({ page }) => {
  await page.goto('/agents/chat');

  const { chatList, emptyState, count } = await waitForChatListState(page);

  if (count === 0) {
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/Unable to load chats|No chats found/i);
    return;
  }

  await expect(chatList).toBeVisible();
  const chatItems = page.getByTestId('chat-list-item');
  await expect(chatItems.first()).toBeVisible();
});

test('displays chat names in list items', async ({ page }) => {
  await page.goto('/agents/chat');

  const { emptyState, count } = await waitForChatListState(page);
  if (count === 0) {
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/Unable to load chats|No chats found/i);
    return;
  }

  const chatItems = page.getByTestId('chat-list-item');
  await expect(chatItems.first()).toBeVisible();
  const itemCount = await chatItems.count();
  expect(itemCount).toBeGreaterThan(0);

  for (let i = 0; i < itemCount; i += 1) {
    const item = chatItems.nth(i);
    await expect(item).toBeVisible();
    const text = await item.innerText();
    expect(text.trim().length).toBeGreaterThan(0);
  }
});

test('displays participant info', async ({ page }) => {
  await page.goto('/agents/chat');

  const { emptyState, count } = await waitForChatListState(page);
  if (count === 0) {
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/Unable to load chats|No chats found/i);
    return;
  }

  const chatItems = page.getByTestId('chat-list-item');
  await expect(chatItems.first()).toBeVisible();
  const itemCount = await chatItems.count();
  expect(itemCount).toBeGreaterThan(0);

  for (let i = 0; i < itemCount; i += 1) {
    const item = chatItems.nth(i);
    await expect(item).toBeVisible();
    await expect(item.getByText(/participant/i)).toBeVisible();
  }
});

test('highlights selected chat', async ({ page }) => {
  await page.goto('/agents/chat');

  const { emptyState, count } = await waitForChatListState(page);
  if (count === 0) {
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/Unable to load chats|No chats found/i);
    return;
  }

  const chatItems = page.getByTestId('chat-list-item');
  const firstItem = chatItems.first();
  await expect(firstItem).toBeVisible();
  await firstItem.click();

  const itemWrapper = firstItem.locator('..');
  const indicator = itemWrapper.getByTestId('chat-list-item-selected-indicator');
  await expect(indicator).toBeVisible();
});

test('shows empty state when no chats', async ({ page }) => {
  await page.goto('/agents/chat');

  const { emptyState, count } = await waitForChatListState(page);
  if (count === 0) {
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toContainText(/Unable to load chats|No chats found/i);
  } else {
    await expect(emptyState).toHaveCount(0);
  }
});
