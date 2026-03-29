import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';
import { createChat, createOrganization, sendChatMessage } from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

test('shows chat messages', async ({ page }) => {
  const message = `E2E detail message ${Date.now()}`;
  const organizationId = await createOrganization(page, `e2e-org-detail-${Date.now()}`);
  const chatId = await createChat(page, organizationId);
  await sendChatMessage(page, chatId, message);
  await setSelectedOrganization(page, organizationId);

  const messagesLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto(`/chats/${encodeURIComponent(chatId)}`);
  await messagesLoaded;

  const messageItem = page.getByTestId('chat-message').filter({ hasText: message });
  await expect(messageItem).toBeVisible({ timeout: 15000 });
  await argosScreenshot(page, 'chat-detail-messages');
});
