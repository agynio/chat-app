import { test, expect } from './multi-user-fixtures';
import { createChat, resolveIdentityId, sendChatMessage } from './chat-api';

test('two users exchange messages in a shared chat', async ({ userAPage, userBPage }) => {
  const messageFromA = `Hello from User A ${Date.now()}`;
  const messageFromB = `Reply from User B ${Date.now()}`;

  const userBId = await resolveIdentityId(userBPage);
  const chatId = await createChat(userAPage, userBId);
  await sendChatMessage(userAPage, chatId, messageFromA);

  const userAMessagesLoaded = userAPage.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userAPage.goto(`/chats/${chatId}`);
  await userAMessagesLoaded;
  await expect(userAPage.getByTestId('chat-message').filter({ hasText: messageFromA })).toBeVisible({
    timeout: 15000,
  });

  const userBMessagesLoaded = userBPage.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await userBPage.goto(`/chats/${chatId}`);
  await userBMessagesLoaded;
  await expect(userBPage.getByTestId('chat-message').filter({ hasText: messageFromA })).toBeVisible({
    timeout: 15000,
  });

  const editorB = userBPage.getByTestId('markdown-composer-editor');
  await editorB.click();
  await userBPage.keyboard.type(messageFromB);
  await userBPage.getByLabel('Send message').click();
  await expect(userBPage.getByTestId('chat-message').filter({ hasText: messageFromB })).toBeVisible({
    timeout: 15000,
  });

  await userAPage.reload();
  await expect(userAPage.getByTestId('chat-message').filter({ hasText: messageFromB })).toBeVisible({
    timeout: 15000,
  });
});
