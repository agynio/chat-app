import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './multi-user-fixtures';
import { createChat, resolveIdentityId, sendChatMessage } from './chat-api';

test('shows chat messages', async ({ userAPage, userBPage }) => {
  const message = `E2E detail message ${Date.now()}`;
  const userBId = await resolveIdentityId(userBPage);
  const chatId = await createChat(userAPage, userBId);
  await sendChatMessage(userAPage, chatId, message);

  const messagesLoaded = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.goto(`/chats/${chatId}`);
  await messagesLoaded;

  const messageItem = userAPage.getByTestId('chat-message').filter({ hasText: message });
  await expect(messageItem).toBeVisible({ timeout: 15000 });
  await argosScreenshot(userAPage, 'chat-detail-messages');
});
