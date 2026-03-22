import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './chat-fixtures';
import { getChatTitle, getParticipantLabel, openChatFromList, waitForChatListState } from './chat-helpers';

test.setTimeout(45000);

test('shows empty state when no chat selected', async ({ page }) => {
  await page.goto('/agents/chat');
  await waitForChatListState(page);

  const emptyState = page.getByTestId('chat-conversation-empty');
  await expect(emptyState).toBeVisible();
  await expect(emptyState).toContainText(/Select a chat/i);
  await argosScreenshot(page, 'chat-conversation-empty');
});

test('renders conversation header for selected chat', async ({ page, chatSeed }) => {
  const chat = chatSeed.chats[0];
  await openChatFromList(page, chat, chatSeed.currentUserId);

  const header = page.getByTestId('chat-conversation-header');
  await expect(header).toBeVisible();
  await expect(header).toContainText(getChatTitle(chat, chatSeed.currentUserId));
  await expect(header).toContainText(getParticipantLabel(chat));
  await argosScreenshot(page, 'chat-conversation-header');
});

test('renders messages for selected chat', async ({ page, chatSeed }) => {
  const chat = chatSeed.chats[0];
  const messages = chatSeed.messagesByChatId[chat.id] ?? [];
  await openChatFromList(page, chat, chatSeed.currentUserId);

  await expect(page.getByTestId('chat-message')).toHaveCount(messages.length);
  for (const message of messages) {
    await expect(page.getByText(message.body)).toBeVisible();
  }
  await argosScreenshot(page, 'chat-conversation-messages');
});
