import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';
import {
  createChat,
  DEFAULT_TEST_INIT_IMAGE,
  getMessages,
  resolveIdentityId,
  sendChatMessage,
  setupTestAgent,
  waitForAgentReply,
} from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

const TESTLLM_ENDPOINT = 'https://testllm.dev/v1/org/agynio/suite/codex/responses';

test('agent responds via TestLLM', async ({ page }) => {
  test.setTimeout(180000);

  const { organizationId, agentId, agentName } = await setupTestAgent(page, {
    endpoint: TESTLLM_ENDPOINT,
    initImage: DEFAULT_TEST_INIT_IMAGE,
  });
  await setSelectedOrganization(page, organizationId);
  const userId = await resolveIdentityId(page);
  const chatId = await createChat(page, organizationId, agentId);

  await sendChatMessage(page, chatId, 'hello');
  const initialMessages = await getMessages(page, chatId);
  expect(initialMessages.some((message) => message.body === 'hello')).toBe(true);

  const agentReply = await waitForAgentReply(page, chatId, userId, 150000);
  expect(agentReply.body).toContain('How are you');

  const chatsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetChats') && resp.status() === 200,
    { timeout: 15000 },
  );
  const agentsLoaded = page.waitForResponse(
    (resp) => resp.url().includes('ListAgents') && resp.status() === 200,
    { timeout: 15000 },
  );
  const messagesLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto(`/chats/${chatId}`);
  await chatsLoaded;
  await agentsLoaded;
  await messagesLoaded;

  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible({ timeout: 15000 });
  await expect(chatList.getByText(agentName)).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('chat-detail-header-title')).toContainText(agentName, {
    timeout: 15000,
  });

  await expect(page.getByTestId('chat-message').filter({ hasText: 'hello' })).toBeVisible({
    timeout: 15000,
  });
  const agentMessage = page.getByTestId('chat-message').filter({ hasText: 'How are you' });
  await expect(agentMessage).toBeVisible({
    timeout: 15000,
  });
  await expect(agentMessage.getByText(agentName)).toBeVisible({ timeout: 15000 });
  // Verify our specific chat doesn't show "(unknown participant)" anywhere
  // Find the specific chat list item that contains our agent name
  const ourChatItem = chatList.locator('.cursor-pointer', { hasText: agentName });
  await expect(ourChatItem).toBeVisible({ timeout: 15000 });
  await expect(ourChatItem.getByText('(unknown participant)')).toHaveCount(0, { timeout: 15000 });

  // Header and messages are already scoped to the selected chat; verify no unknown there
  await expect(
    page.getByTestId('chat-detail-header-title').getByText('(unknown participant)'),
  ).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByTestId('chat-message').filter({ hasText: '(unknown participant)' })).toHaveCount(0, {
    timeout: 15000,
  });

  await argosScreenshot(page, 'agent-testllm-response');
});
