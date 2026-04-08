import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './multi-user-fixtures';
import { createChat, createOrganization, resolveIdentityId, sendChatMessage } from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

test('two users exchange messages in a shared chat', async ({ userAPage, userBPage }) => {
  const messageFromA = `Hello from User A ${Date.now()}`;
  const messageFromB = `Reply from User B ${Date.now()}`;

  const userBId = await resolveIdentityId(userBPage);
  const organizationId = await createOrganization(userAPage, `e2e-org-exchange-a-${Date.now()}`);
  const chatId = await createChat(userAPage, organizationId, userBId);
  await sendChatMessage(userAPage, chatId, messageFromA);
  await setSelectedOrganization(userAPage, organizationId);
  // User B needs their own org to pass the org gate; direct URL access works because GetMessages/SendMessage ignore orgs.
  const userBOrganizationId = await createOrganization(userBPage, `e2e-org-exchange-b-${Date.now()}`);
  await setSelectedOrganization(userBPage, userBOrganizationId);

  const userAChatsLoaded = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  const userAMessagesLoaded = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.goto(`/chats/${encodeURIComponent(chatId)}`);
  await userAChatsLoaded;
  await userAMessagesLoaded;
  await expect(userAPage.getByTestId('chat-message').filter({ hasText: messageFromA })).toBeVisible({
    timeout: 15000,
  });

  const userBChatsLoaded = userBPage.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  const userBMessagesLoaded = userBPage.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userBPage.goto(`/chats/${encodeURIComponent(chatId)}`);
  await userBChatsLoaded;
  await userBMessagesLoaded;
  await expect(userBPage.getByTestId('chat-message').filter({ hasText: messageFromA })).toBeVisible({
    timeout: 15000,
  });

  const editorB = userBPage.getByTestId('markdown-composer-editor');
  await editorB.click();
  await userBPage.keyboard.type(messageFromB);
  const userBSendMessage = userBPage.waitForResponse(
    (resp) => resp.url().includes('SendMessage') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userBPage.getByLabel('Send message').click();
  await userBSendMessage;
  await expect(userBPage.getByTestId('chat-message').filter({ hasText: messageFromB })).toBeVisible({
    timeout: 15000,
  });

  const userAReloadedMessages = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.reload();
  await userAReloadedMessages;
  await expect(userAPage.getByTestId('chat-message').filter({ hasText: messageFromB })).toBeVisible({
    timeout: 15000,
  });
  await argosScreenshot(userAPage, 'two-user-message-exchange');
});
