import { argosScreenshot } from '@argos-ci/playwright';
import * as crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures';
import { createAgent, createChat, createOrganization, sendChatMessage } from './chat-api';
import { setSelectedOrganization } from './organization-helpers';

const FIXTURE_PATH = fileURLToPath(new URL('./fixtures/test-upload.txt', import.meta.url));

test('uploads a file and sends a message with attachment', async ({ page }) => {
  test.setTimeout(90_000);

  const now = Date.now();
  const organizationId = await createOrganization(page, `e2e-org-upload-${now}`);
  const agentId = await createAgent(page, {
    organizationId,
    name: `e2e-agent-${now}`,
    role: 'assistant',
    model: crypto.randomUUID(),
    description: 'E2E test agent',
    configuration: '{}',
    image: 'alpine:3.21',
  });
  const chatId = await createChat(page, organizationId, agentId);
  await sendChatMessage(page, chatId, `Upload warmup ${now}`);
  await setSelectedOrganization(page, organizationId);

  const messagesLoaded = page.waitForResponse(
    (resp) => resp.url().includes('GetMessages') && resp.status() === 200,
    { timeout: 15000 },
  );
  await page.goto(`/chats/${encodeURIComponent(chatId)}`);
  await messagesLoaded;

  await page.getByTestId('file-attachment-input').setInputFiles(FIXTURE_PATH);

  const attachmentChip = page.getByTestId('attachment-chip').filter({ hasText: 'test-upload.txt' });
  await expect(attachmentChip).toBeVisible({ timeout: 15000 });
  await expect(attachmentChip).toHaveAttribute('data-status', 'completed', { timeout: 60000 });
  await argosScreenshot(page, 'file-upload-ready-to-send');

  const message = `File upload message ${now}`;
  const sendMessage = page.waitForResponse(
    (resp) => resp.url().includes('SendMessage') && resp.status() === 200,
    { timeout: 15000 },
  );
  const editor = page.getByTestId('markdown-composer-editor');
  await editor.click();
  await page.keyboard.type(message);
  await page.getByLabel('Send message').click();
  await sendMessage;

  const messageItem = page.getByTestId('chat-message').filter({ hasText: message });
  await expect(messageItem).toBeVisible({ timeout: 15000 });
  await expect(messageItem).toContainText('1 attachment');

  await argosScreenshot(page, 'file-upload-message-sent');
});
