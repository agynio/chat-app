import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';
import { createChat, sendChatMessage } from './chat-api';

test('shows chat messages', async ({ page }) => {
  const message = `E2E detail message ${Date.now()}`;
  const chatId = await createChat(page);
  await sendChatMessage(page, chatId, message);

  await page.goto(`/chats/${chatId}`);
  await page.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );

  const messageItem = page.getByTestId('chat-message').filter({ hasText: message });
  await expect(messageItem).toBeVisible({ timeout: 15000 });
  await argosScreenshot(page, 'chat-detail-messages');
});
