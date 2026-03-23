import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { listAgents } from './chat-api';

async function expectConversationsListVisible(page: Page) {
  const list = page.getByTestId('conversations-list');
  try {
    await expect(list).toBeVisible({ timeout: 5000 });
    return;
  } catch {
    const emptyState = page.getByText(/No conversations (available yet|match the current filter)/);
    await expect(emptyState).toBeVisible();
  }
}

test('renders conversation list on load', async ({ page }) => {
  await page.goto('/conversations');

  await expectConversationsListVisible(page);
  await argosScreenshot(page, 'conversations-list-loaded');
});

test('creates a conversation via the UI', async ({ page }) => {
  const message = `E2E list message ${Date.now()}`;

  await page.goto('/conversations');
  await page.getByTitle('New conversation').click();

  const participantInput = page.getByPlaceholder('Search participants...');
  await expect(participantInput).toBeVisible();
  await participantInput.click();

  const agents = await listAgents(page.request);
  if (agents.length === 0) {
    await expect(page.getByText('Add participants to start a conversation.')).toBeVisible();
    await expect(page.getByText('Start your new conversation by adding participants.')).toBeVisible();
    await argosScreenshot(page, 'conversations-list-create-empty');
    return;
  }

  const selectedAgent = agents[0];
  await participantInput.fill(selectedAgent.name);

  const option = page.getByRole('button', { name: selectedAgent.name }).first();
  await option.waitFor();
  await option.click();

  const editor = page.getByTestId('markdown-composer-editor');
  await editor.click();
  await page.keyboard.type(message);

  const sendButton = page.getByLabel('Send message');
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page).toHaveURL(/\/conversations\//);
  await expect(page.getByTestId('conversation-message').filter({ hasText: message })).toBeVisible();

  const conversationsList = page.getByTestId('conversations-list');
  await expect(conversationsList.getByText(selectedAgent.name).first()).toBeVisible();
  await argosScreenshot(page, 'conversations-list-created');
});
