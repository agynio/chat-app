import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import {
  createAgent,
  createChat,
  createLLMProvider,
  createModel,
  createOrganization,
  getMessages,
  resolveIdentityId,
  sendChatMessage,
  waitForAgentReply,
} from './chat-api';

const TESTLLM_ENDPOINT = 'https://testllm.dev/v1/org/agynio/suite/codex';
const INIT_IMAGE = 'ghcr.io/agynio/agent-init-codex:0.5.0';

async function setupTestAgent(page: Page) {
  const now = Date.now();
  const organizationId = await createOrganization(page, `e2e-org-llm-${now}`);

  const providerId = await createLLMProvider(page, {
    endpoint: TESTLLM_ENDPOINT,
    authMethod: 'AUTH_METHOD_BEARER',
    token: 'unused',
    organizationId,
  });

  const modelId = await createModel(page, {
    name: `e2e-model-${now}`,
    llmProviderId: providerId,
    remoteName: 'simple-hello',
    organizationId,
  });

  const agentId = await createAgent(page, {
    organizationId,
    name: `e2e-codex-agent-${now}`,
    role: 'You are a helpful assistant.',
    model: modelId,
    description: 'E2E test agent using TestLLM simple-hello',
    configuration: '{}',
    image: 'alpine:3.21',
    initImage: INIT_IMAGE,
  });

  return { organizationId, agentId };
}

test('agent responds via TestLLM', async ({ page }) => {
  test.setTimeout(180000);

  const { agentId } = await setupTestAgent(page);
  const userId = await resolveIdentityId(page);
  const chatId = await createChat(page, agentId);

  await sendChatMessage(page, chatId, 'hello');
  const initialMessages = await getMessages(page, chatId);
  expect(initialMessages.some((message) => message.body === 'hello')).toBe(true);

  const agentReply = await waitForAgentReply(page, chatId, userId, 150000);
  expect(agentReply.body).toContain('How are you');

  const messagesLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto(`/chats/${chatId}`);
  await messagesLoaded;

  await expect(page.getByTestId('chat-message').filter({ hasText: 'hello' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByTestId('chat-message').filter({ hasText: 'How are you' })).toBeVisible({
    timeout: 15000,
  });

  await argosScreenshot(page, 'agent-testllm-response');
});
