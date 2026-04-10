import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './multi-user-fixtures';
import { createChat, createOrganization, resolveIdentityId, resolveUserLabel } from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

test('moves chat from open to resolved', async ({ userAPage, userBPage }) => {
  const now = Date.now();
  const organizationId = await createOrganization(userAPage, `e2e-org-status-${now}`);
  await setSelectedOrganization(userAPage, organizationId);
  const userBId = await resolveIdentityId(userBPage);
  const chatId = await createChat(userAPage, organizationId, userBId);
  const userBLabel = await resolveUserLabel(userAPage, userBId);

  const chatsLoaded = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.goto('/chats');
  await chatsLoaded;

  const chatList = userAPage.getByTestId('chat-list');
  await expect(chatList).toBeVisible({ timeout: 15000 });

  const chatItem = chatList.locator('.cursor-pointer', { hasText: userBLabel }).first();
  await expect(chatItem).toBeVisible({ timeout: 15000 });
  await chatItem.click();

  await expect(userAPage).toHaveURL(new RegExp(`/chats/${encodeURIComponent(chatId)}`));

  const statusTrigger = userAPage.getByRole('button', { name: /^Chat status:/ });
  await expect(statusTrigger).toBeVisible({ timeout: 15000 });
  await expect(statusTrigger).toHaveAttribute('aria-label', 'Chat status: Open');

  await statusTrigger.focus();
  await statusTrigger.press('Enter');
  await userAPage.keyboard.press('ArrowDown');
  const updateChat = userAPage.waitForResponse(
    (resp) => resp.url().includes('UpdateChat') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.keyboard.press('Enter');
  await updateChat;

  const resolvedChatsLoaded = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.getByRole('button', { name: 'Resolved', exact: true }).click();
  await resolvedChatsLoaded;
  const resolvedChatItem = chatList.locator('.cursor-pointer', { hasText: userBLabel }).first();
  await expect(resolvedChatItem).toBeVisible({ timeout: 15000 });

  await argosScreenshot(userAPage, 'chat-status-switch-resolved');
});
