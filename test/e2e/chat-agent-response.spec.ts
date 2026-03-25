import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import * as crypto from 'node:crypto';
import { test, expect } from './fixtures';
import {
  createAgent,
  createAgentEnv,
  createChat,
  createOrganization,
  getMessages,
  resolveIdentityId,
  sendChatMessage,
  waitForAgentReply,
} from './chat-api';

const TESTLLM_BASE_URL = 'https://testllm.dev/v1/org/agynio/suite/agn';
const INIT_IMAGE = 'ghcr.io/agynio/agent-init-codex:0.1.0';

async function setupTestAgent(page: Page) {
  const now = Date.now();
  const organizationId = await createOrganization(page, `e2e-org-llm-${now}`);
  const agentId = await createAgent(page, {
    organizationId,
    name: `e2e-codex-agent-${now}`,
    role: 'You are a helpful assistant.',
    model: crypto.randomUUID(),
    description: 'E2E test agent using TestLLM simple-hello',
    configuration: '{}',
    image: 'alpine:3.21',
    initImage: INIT_IMAGE,
  });

  const envVars: Record<string, string> = {
    THREADS_ADDRESS: 'threads:50051',
    NOTIFICATIONS_ADDRESS: 'notifications:50051',
    TEAMS_ADDRESS: 'agents:50051',
    OPENAI_API_KEY: 'dummy',
    OPENAI_BASE_URL: TESTLLM_BASE_URL,
    CODEX_BINARY: '/agyn-bin/codex',
  };

  for (const [name, value] of Object.entries(envVars)) {
    await createAgentEnv(page, agentId, name, value);
  }

  return { organizationId, agentId };
}

test('agent responds via TestLLM', async ({ page }) => {
  test.setTimeout(180000);

  const { agentId } = await setupTestAgent(page);
  const userId = await resolveIdentityId(page);
  const chatId = await createChat(page, agentId);

  await sendChatMessage(page, chatId, 'hi');
  const initialMessages = await getMessages(page, chatId);
  expect(initialMessages.some((message) => message.body === 'hi')).toBe(true);

  const agentReply = await waitForAgentReply(page, chatId, userId, 120000);
  expect(agentReply.body).toContain('How are you');

  const messagesLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto(`/chats/${chatId}`);
  await messagesLoaded;

  await expect(page.getByTestId('chat-message').filter({ hasText: 'hi' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByTestId('chat-message').filter({ hasText: 'How are you' })).toBeVisible({
    timeout: 15000,
  });

  await argosScreenshot(page, 'agent-testllm-response');
});
