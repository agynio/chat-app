import { argosScreenshot } from '@argos-ci/playwright';
import type { Agent } from '../../src/api/types/agents';
import { test as singleUserTest, expect } from './fixtures';
import { test as multiUserTest, USER_B_EMAIL } from './multi-user-fixtures';
import { createAgent, createChat, deleteAgent, resolveUserId } from './chat-api';

const LIST_AGENTS_ROUTE = '**/api/agynio.api.gateway.v1.AgentsGateway/ListAgents';

singleUserTest.describe('chat creation', () => {
  let seededAgent: { id: string; name: string } | null = null;
  let seededAgentWire: Agent | null = null;

  singleUserTest.beforeEach(async ({ page }) => {
    seededAgent = await createAgent(page);
    const now = new Date().toISOString();
    seededAgentWire = {
      meta: { id: seededAgent.id, createdAt: now, updatedAt: now },
      name: seededAgent.name,
      role: 'assistant',
      model: 'e2e-model',
      description: 'E2E test agent',
      configuration: {},
      image: '',
    };

    await page.route(LIST_AGENTS_ROUTE, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ agents: seededAgentWire ? [seededAgentWire] : [] }),
      });
    });
  });

  singleUserTest.afterEach(async ({ page }) => {
    await page.unroute(LIST_AGENTS_ROUTE);
    if (seededAgent) {
      await deleteAgent(page, seededAgent.id);
      seededAgent = null;
    }
    seededAgentWire = null;
  });

  singleUserTest('creates a new chat with an agent', async ({ page }) => {
    if (!seededAgent) {
      throw new Error('Seeded agent missing for chat creation test.');
    }

    const message = `Plan the Q3 launch roadmap ${Date.now()}.`;

    await page.goto('/chats');
    await page.getByTitle('New chat').click();

    const participantInput = page.getByPlaceholder('Search participants...');
    await expect(participantInput).toBeVisible();
    await participantInput.click();
    await participantInput.fill(seededAgent.name);

    const option = page.getByRole('button', { name: seededAgent.name }).first();
    await option.waitFor();
    await option.click();

    const editor = page.getByTestId('markdown-composer-editor');
    await editor.click();
    await page.keyboard.type(message);

    const sendButton = page.getByLabel('Send message');
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    await expect(page).toHaveURL(/\/chats\//);
    await expect(page.getByTestId('chat-message').filter({ hasText: message })).toBeVisible();

    const chatList = page.getByTestId('chat-list');
    await expect(chatList.getByText(seededAgent.name).first()).toBeVisible();
    await argosScreenshot(page, 'chat-create-complete');
  });
});

multiUserTest('creates a new chat with another user', async ({ userAPage, userBPage }) => {
  const userBId = await resolveUserId(userBPage, USER_B_EMAIL);
  const chatId = await createChat(userAPage, userBId);

  await userAPage.goto('/chats');
  const userAChatList = userAPage.getByTestId('chat-list');
  await expect(userAChatList).toBeVisible();
  await expect(userAChatList.getByText('(unknown participant)').first()).toBeVisible();

  await userAPage.goto(`/chats/${chatId}`);
  await expect(userAPage.getByTestId('chat')).toBeVisible();

  await userBPage.goto('/chats');
  const userBChatList = userBPage.getByTestId('chat-list');
  await expect(userBChatList).toBeVisible();
  await expect(userBChatList.getByText('(unknown participant)').first()).toBeVisible();

  await userBPage.goto(`/chats/${chatId}`);
  await expect(userBPage.getByTestId('chat')).toBeVisible();
});
