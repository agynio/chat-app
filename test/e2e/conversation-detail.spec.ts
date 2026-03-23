import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';
import { createChat, sendChatMessage } from './chat-api';

test('shows conversation messages', async ({ page }) => {
  const message = `E2E detail message ${Date.now()}`;
  const chatId = await createChat(page.context());
  await sendChatMessage(page.context(), chatId, message);

  await page.goto(`/conversations/${chatId}`);

  const messageItem = page.getByTestId('conversation-message').filter({ hasText: message });
  await expect(messageItem).toBeVisible();
  await argosScreenshot(page, 'conversation-detail-messages');
});
