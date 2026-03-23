import { test, expect, USER_B_EMAIL } from './multi-user-fixtures';
import { createChat, resolveUserId, sendChatMessage } from './chat-api';

test('two users exchange messages in a shared chat', async ({ userAPage, userBPage }) => {
  const messageFromA = `Hello from User A ${Date.now()}`;
  const messageFromB = `Reply from User B ${Date.now()}`;

  const userBId = await resolveUserId(userBPage, USER_B_EMAIL);
  const chatId = await createChat(userAPage, userBId);
  await sendChatMessage(userAPage, chatId, messageFromA);

  await userAPage.goto(`/chats/${chatId}`);
  await expect(userAPage.getByTestId('chat-message').filter({ hasText: messageFromA })).toBeVisible();

  await userBPage.goto(`/chats/${chatId}`);
  await expect(userBPage.getByTestId('chat-message').filter({ hasText: messageFromA })).toBeVisible();

  const editorB = userBPage.getByTestId('markdown-composer-editor');
  await editorB.click();
  await userBPage.keyboard.type(messageFromB);
  await userBPage.getByLabel('Send message').click();
  await expect(userBPage.getByTestId('chat-message').filter({ hasText: messageFromB })).toBeVisible();

  await userAPage.reload();
  await expect(userAPage.getByTestId('chat-message').filter({ hasText: messageFromB })).toBeVisible();
});
