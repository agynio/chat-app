import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './multi-user-fixtures';
import { createChat, createOrganization, resolveIdentityId, updateChatStatus } from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

test('moves chat from open to resolved', async ({ userAPage, userBPage }) => {
  const now = Date.now();
  const organizationId = await createOrganization(userAPage, `e2e-org-status-${now}`);
  await setSelectedOrganization(userAPage, organizationId);
  const userBId = await resolveIdentityId(userBPage);
  const chatId = await createChat(userAPage, organizationId, userBId);
  await updateChatStatus(userAPage, chatId, 'open');

  const chatsLoaded = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.goto('/chats');
  await chatsLoaded;

  const chatList = userAPage.getByTestId('chat-list');
  await expect(chatList).toBeVisible({ timeout: 15000 });

  const chatItems = chatList.locator('.cursor-pointer');
  await expect(chatItems).toHaveCount(1, { timeout: 15000 });
  await chatItems.first().click();

  await expect(userAPage).toHaveURL(new RegExp(`/chats/${encodeURIComponent(chatId)}`));

  const statusTrigger = userAPage.getByRole('button', { name: /^Chat status:/ });
  await expect(statusTrigger).toBeVisible({ timeout: 15000 });
  await statusTrigger.click();

  const updateChat = userAPage.waitForResponse(
    (resp) => resp.url().includes('UpdateChat') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.getByRole('menuitemradio', { name: 'Resolved' }).click();
  await updateChat;

  const resolvedChatsLoaded = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.getByRole('button', { name: 'Resolved', exact: true }).click();
  await resolvedChatsLoaded;
  await expect(chatList.locator('.cursor-pointer')).toHaveCount(1, { timeout: 15000 });

  await argosScreenshot(userAPage, 'chat-status-switch-resolved');
});
