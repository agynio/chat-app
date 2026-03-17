import { test, expect, isMocked } from './fixtures';

const threadOne = {
  id: '11111111-1111-1111-1111-111111111111',
  summary: 'Draft a Q2 marketing brief for the launch campaign.',
  agentName: 'Campaign Planner',
};

test('renders thread list on load', async ({ page }) => {
  await page.goto('/agents/threads');

  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList).toBeVisible();

  if (isMocked) {
    await expect(threadsList.getByText(threadOne.summary)).toBeVisible();
    await expect(threadsList.getByText(threadOne.agentName)).toBeVisible();
  }
});

test('navigates to thread detail', async ({ page }) => {
  await page.goto('/agents/threads');

  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList).toBeVisible();

  if (isMocked) {
    await threadsList.getByText(threadOne.summary).click();
    await expect(page).toHaveURL(`/agents/threads/${threadOne.id}`);
    await expect(page.getByRole('heading', { name: threadOne.summary })).toBeVisible();
    return;
  }

  await threadsList.locator('.cursor-pointer').first().click();
  await expect(page).toHaveURL(/\/agents\/threads\//);
  await expect(page.getByTestId('conversation')).toBeVisible();
});

test('redirects root to /agents/threads', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/agents\/threads$/);
  await expect(page.getByTestId('threads-list')).toBeVisible();
});
