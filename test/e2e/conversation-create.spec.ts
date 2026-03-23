import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';
import { listAgents } from './chat-api';

test('creates a new conversation', async ({ page }) => {
  const message = `Plan the Q3 launch roadmap ${Date.now()}.`;

  await page.goto('/conversations');
  await page.getByTitle('New conversation').click();

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

  await expect(page).toHaveURL(/\/conversations\//);
  await expect(page.getByTestId('chat-message').filter({ hasText: message })).toBeVisible();

  const conversationsList = page.getByTestId('conversations-list');
  await expect(conversationsList.getByText(selectedAgent.name).first()).toBeVisible();
  await argosScreenshot(page, 'conversation-create-complete');
});
