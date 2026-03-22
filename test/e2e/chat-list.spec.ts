import { argosScreenshot } from '@argos-ci/playwright';
import { test, emptyTest, expect } from './chat-fixtures';
import { getChatTitle, getParticipantLabel, waitForChatListState } from './chat-helpers';

test.setTimeout(45000);

test('renders chat list items', async ({ page, chatSeed }) => {
  await page.goto('/agents/chat');
  const { list, count } = await waitForChatListState(page);

  await expect(list).toBeVisible();
  expect(count).toBe(chatSeed.chats.length);
  await expect(page.getByText(`${chatSeed.chats.length} conversations`)).toBeVisible();
  await argosScreenshot(page, 'chat-list-items');
});

test('displays chat participant names', async ({ page, chatSeed }) => {
  await page.goto('/agents/chat');
  await waitForChatListState(page);

  for (const chat of chatSeed.chats.slice(0, 2)) {
    const title = getChatTitle(chat, chatSeed.currentUserId);
    await expect(page.getByTestId('chat-list-item').filter({ hasText: title })).toBeVisible();
  }
  await argosScreenshot(page, 'chat-list-participant-names');
});

test('shows participant counts for chats', async ({ page, chatSeed }) => {
  await page.goto('/agents/chat');
  await waitForChatListState(page);

  const chat = chatSeed.chats[0];
  const title = getChatTitle(chat, chatSeed.currentUserId);
  const chatItem = page.getByTestId('chat-list-item').filter({ hasText: title }).first();
  await expect(chatItem).toBeVisible();
  await expect(chatItem).toContainText(getParticipantLabel(chat));
  await argosScreenshot(page, 'chat-list-participant-counts');
});

test('highlights selected chat', async ({ page, chatSeed }) => {
  await page.goto('/agents/chat');
  await waitForChatListState(page);

  const chat = chatSeed.chats[1] ?? chatSeed.chats[0];
  const title = getChatTitle(chat, chatSeed.currentUserId);
  const chatItem = page.getByTestId('chat-list-item').filter({ hasText: title }).first();
  await expect(chatItem).toBeVisible();
  await chatItem.click();

  await expect(page).toHaveURL(new RegExp(`/agents/chat/${chat.id}$`));
  const wrapper = chatItem.locator('..');
  await expect(wrapper.getByTestId('chat-list-item-selected-indicator')).toBeVisible();
  await argosScreenshot(page, 'chat-list-selected');
});

emptyTest('shows empty state when no chats', async ({ page }) => {
  await page.goto('/agents/chat');
  const { emptyState, count } = await waitForChatListState(page);

  expect(count).toBe(0);
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText(/No chats found/i);
  await argosScreenshot(page, 'chat-list-empty');
});
