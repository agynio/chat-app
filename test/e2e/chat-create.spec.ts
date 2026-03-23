import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';
import { listAgents } from './chat-api';

test('creates a new chat', async ({ page }) => {
  const message = `Plan the Q3 launch roadmap ${Date.now()}.`;

  await page.goto('/chats');
  await page.getByTitle('New chat').click();

  const participantInput = page.getByPlaceholder('Search participants...');
  await expect(participantInput).toBeVisible();
  await participantInput.click();

  const agents = await listAgents(page.context());
  test.skip(agents.length === 0, 'No agents available in the cluster — skipping');
  if (agents.length === 0) {
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

  await expect(page).toHaveURL(/\/chats\//);
  await expect(page.getByTestId('chat-message').filter({ hasText: message })).toBeVisible();

  const chatList = page.getByTestId('chat-list');
  await expect(chatList.getByText(selectedAgent.name).first()).toBeVisible();
  await argosScreenshot(page, 'chat-create-complete');
});
