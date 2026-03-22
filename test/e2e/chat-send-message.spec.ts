import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './chat-fixtures';
import { openChatFromList } from './chat-helpers';

test.setTimeout(45000);

test('enables input for selected chat', async ({ page, chatSeed }) => {
  const chat = chatSeed.chats[0];
  await openChatFromList(page, chat, chatSeed.currentUserId);

  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');

  await expect(input).toBeEnabled();
  await expect(sendButton).toBeDisabled();
  await argosScreenshot(page, 'chat-send-input-ready');
});

test('allows typing and enables send', async ({ page, chatSeed }) => {
  const chat = chatSeed.chats[0];
  await openChatFromList(page, chat, chatSeed.currentUserId);

  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');
  await input.fill('Following up on the demo notes.');

  await expect(sendButton).toBeEnabled();
  await argosScreenshot(page, 'chat-send-input-filled');
});

test('sends message and renders it', async ({ page, chatSeed }) => {
  const chat = chatSeed.chats[0];
  await openChatFromList(page, chat, chatSeed.currentUserId);

  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');
  const messageText = 'Playwright: sending a follow-up message.';

  await input.fill(messageText);
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(input).toHaveValue('');
  await expect(page.getByText(messageText)).toBeVisible();
  await argosScreenshot(page, 'chat-send-message-sent');
});
