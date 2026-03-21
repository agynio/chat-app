import { test, expect } from './chat-fixtures';
import { waitForChatListState } from './chat-helpers';

test.setTimeout(45000);

test.beforeEach(async ({ page }) => {
  await page.goto('/agents/chat');
  await waitForChatListState(page);
});

test('shows input and send button', async ({ page }) => {
  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');

  await expect(input).toBeVisible();
  await expect(sendButton).toBeVisible();
  await expect(input).toBeDisabled();
  await expect(sendButton).toBeDisabled();
});

test('send button disabled when input empty', async ({ page }) => {
  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');
  await expect(input).toBeDisabled();
  await expect(sendButton).toBeDisabled();
});

test('input remains disabled when no chat selected', async ({ page }) => {
  const input = page.getByTestId('chat-input');
  await expect(input).toBeDisabled();
  await expect(input).toHaveValue('');
});

test('send button remains disabled without a chat', async ({ page }) => {
  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');
  const messages = page.getByTestId('chat-message');

  await expect(input).toBeDisabled();
  await expect(sendButton).toBeDisabled();
  await expect(messages).toHaveCount(0);
});
