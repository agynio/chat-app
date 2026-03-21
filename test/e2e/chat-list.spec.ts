import { test, expect } from './fixtures';

test('renders chat list on load', async ({ page }) => {
  await page.goto('/agents/chat');

  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible();

  const chatItems = page.getByTestId('chat-list-item');
  await expect(chatItems.first()).toBeVisible();
});

test('displays chat names in list items', async ({ page }) => {
  await page.goto('/agents/chat');

  const chatItems = page.getByTestId('chat-list-item');
  await expect(chatItems.first()).toBeVisible();
  const count = await chatItems.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    const item = chatItems.nth(i);
    await expect(item).toBeVisible();
    const text = await item.innerText();
    expect(text.trim().length).toBeGreaterThan(0);
  }
});

test('displays participant info', async ({ page }) => {
  await page.goto('/agents/chat');

  const chatItems = page.getByTestId('chat-list-item');
  await expect(chatItems.first()).toBeVisible();
  const count = await chatItems.count();
  expect(count).toBeGreaterThan(0);

  for (let i = 0; i < count; i += 1) {
    const item = chatItems.nth(i);
    await expect(item).toBeVisible();
    await expect(item.getByText(/participant/i)).toBeVisible();
  }
});

test('highlights selected chat', async ({ page }) => {
  await page.goto('/agents/chat');

  const chatItems = page.getByTestId('chat-list-item');
  const firstItem = chatItems.first();
  await expect(firstItem).toBeVisible();
  await firstItem.click();

  const indicator = firstItem.locator('..').locator(':scope > div');
  await expect(indicator).toBeVisible();
});

test('shows empty state when no chats', async ({ page }) => {
  await page.goto('/agents/chat');

  const chatItems = page.getByTestId('chat-list-item');
  const emptyState = page.getByTestId('chat-list-empty');
  await Promise.race([chatItems.first().waitFor(), emptyState.waitFor()]);
  const count = await chatItems.count();

  if (count === 0) {
    await expect(emptyState).toBeVisible();
  } else {
    await expect(emptyState).toHaveCount(0);
  }
});
