import { test, expect, isMocked } from './fixtures';

test('creates a new thread', async ({ page }) => {
  const message = 'Plan the Q3 launch roadmap.';

  await page.goto('/agents/threads');
  await page.getByTitle('New thread').click();

  const agentInput = page.getByPlaceholder('Search agents...');
  await expect(agentInput).toBeVisible();
  await agentInput.click();

  const option = page.locator('button[data-highlighted]').first();
  await option.waitFor();

  if (isMocked) {
    await expect(option).toHaveText('(unknown agent)');
  }

  await option.click();

  const editor = page.getByTestId('markdown-composer-editor');
  await editor.click();
  await page.keyboard.type(message);

  const sendButton = page.getByLabel('Send message');
  await expect(sendButton).toBeEnabled();
  await sendButton.click();

  await expect(page).toHaveURL(/\/agents\/threads\//);
  await expect(page.getByRole('heading', { name: message })).toBeVisible();

  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList.getByText(message)).toBeVisible();
});
