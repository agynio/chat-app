import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';

test('creates a new conversation', async ({ page }) => {
  const message = 'Plan the Q3 launch roadmap.';

  await page.goto('/conversations');
  await page.getByTitle('New conversation').click();

  const participantInput = page.getByPlaceholder('Search participants...');
  await expect(participantInput).toBeVisible();
  await participantInput.click();

  const option = page.locator('button[data-highlighted="true"]').first();
  await option.waitFor();
  await option.click();

  const editor = page.getByTestId('markdown-composer-editor');
  await editor.click();
  await page.keyboard.type(message);

  const sendButton = page.getByLabel('Send message');
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page).toHaveURL(/\/conversations\//);
  await expect(page.getByRole('heading', { name: message })).toBeVisible();

  const conversationsList = page.getByTestId('conversations-list');
  await expect(conversationsList.getByText(message).first()).toBeVisible();
  await argosScreenshot(page, 'conversation-create-complete');
});
