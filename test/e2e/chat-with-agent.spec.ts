import { argosScreenshot } from '@argos-ci/playwright';
import * as crypto from 'node:crypto';
import { test, expect } from './fixtures';
import { createAgent, createChat, createOrganization, sendChatMessage } from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

test('creates a chat with an agent and sends a message', async ({ page }) => {
  const now = Date.now();
  const organizationId = await createOrganization(page, `e2e-org-agent-${now}`);
  const agentId = await createAgent(page, {
    organizationId,
    name: `e2e-agent-${now}`,
    role: 'assistant',
    model: crypto.randomUUID(),
    description: 'E2E test agent',
    configuration: '{}',
    image: 'agent-image:latest',
  });
  const chatId = await createChat(page, organizationId, agentId);
  const message = `Hello agent ${now}`;
  await sendChatMessage(page, chatId, message);
  await setSelectedOrganization(page, organizationId);

  const messagesLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto(`/chats/${encodeURIComponent(chatId)}`);
  await messagesLoaded;

  await expect(page.getByTestId('chat-message').filter({ hasText: message })).toBeVisible({
    timeout: 15000,
  });
  await argosScreenshot(page, 'chat-with-agent-message');
});

test('agent chat appears in chat list', async ({ page }) => {
  const now = Date.now();
  const organizationId = await createOrganization(page, `e2e-org-agent-${now}`);
  const agentId = await createAgent(page, {
    organizationId,
    name: `e2e-agent-${now}`,
    role: 'assistant',
    model: crypto.randomUUID(),
    description: 'E2E test agent',
    configuration: '{}',
    image: 'agent-image:latest',
  });
  const chatId = await createChat(page, organizationId, agentId);
  await sendChatMessage(page, chatId, `Hello agent ${now}`);
  await setSelectedOrganization(page, organizationId);

  await page.goto('/chats');

  const chatList = page.getByTestId('chat-list');
  await expect(chatList).toBeVisible({ timeout: 15000 });

  const firstChat = chatList.locator('.cursor-pointer').first();
  await expect(firstChat).toBeVisible({ timeout: 15000 });
  await argosScreenshot(page, 'chat-with-agent-list');
});
