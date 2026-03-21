import { test, expect } from './fixtures';
import { openAnyChat } from './chat-helpers';

test('shows input and send button', async ({ page }) => {
  await openAnyChat(page);

  await expect(page.getByTestId('chat-input')).toBeVisible();
  await expect(page.getByTestId('chat-send-button')).toBeVisible();
});

test('send button disabled when input empty', async ({ page }) => {
  await openAnyChat(page);

  const input = page.getByTestId('chat-input');
  await input.fill('');

  await expect(page.getByTestId('chat-send-button')).toBeDisabled();
});

test('can type in input', async ({ page }) => {
  await openAnyChat(page);

  const input = page.getByTestId('chat-input');
  await input.fill('Typing into chat input.');
  await expect(input).toHaveValue('Typing into chat input.');
});

test('sends message on button click', async ({ page }) => {
  await openAnyChat(page);

  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');
  const messages = page.getByTestId('chat-message');
  const initialCount = await messages.count();

  await input.fill('E2E chat message.');
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(input).toHaveValue('');
  await expect.poll(() => messages.count(), { timeout: 10000 }).toBeGreaterThan(initialCount);
});
