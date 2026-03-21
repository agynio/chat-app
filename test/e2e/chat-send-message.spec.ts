import { test, expect } from './fixtures';
import { openAnyChat } from './chat-helpers';

test.setTimeout(45000);

test('shows input and send button', async ({ page }) => {
  const hasChat = await openAnyChat(page);

  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');

  await expect(input).toBeVisible();
  await expect(sendButton).toBeVisible();

  if (!hasChat) {
    await expect(input).toBeDisabled();
    await expect(sendButton).toBeDisabled();
  }
});

test('send button disabled when input empty', async ({ page }) => {
  const hasChat = await openAnyChat(page);

  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');

  if (!hasChat) {
    await expect(sendButton).toBeDisabled();
    return;
  }

  await input.fill('');

  await expect(sendButton).toBeDisabled();
});

test('can type in input', async ({ page }) => {
  const hasChat = await openAnyChat(page);

  const input = page.getByTestId('chat-input');

  if (!hasChat) {
    await expect(input).toBeDisabled();
    return;
  }

  await input.fill('Typing into chat input.');
  await expect(input).toHaveValue('Typing into chat input.');
});

test('sends message on button click', async ({ page }) => {
  const hasChat = await openAnyChat(page);

  const input = page.getByTestId('chat-input');
  const sendButton = page.getByTestId('chat-send-button');

  if (!hasChat) {
    await expect(input).toBeDisabled();
    await expect(sendButton).toBeDisabled();
    return;
  }

  const messages = page.getByTestId('chat-message');
  const initialCount = await messages.count();

  await input.fill('E2E chat message.');
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(input).toHaveValue('');
  await expect.poll(() => messages.count(), { timeout: 10000 }).toBeGreaterThan(initialCount);
});
