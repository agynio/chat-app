import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';

test('renders thread list on load', async ({ page }) => {
  await page.goto('/agents/threads');

  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList).toBeVisible();
  await expect(threadsList.locator('.cursor-pointer').first()).toBeVisible();
  await argosScreenshot(page, 'threads-list-loaded');
});

test('navigates to thread detail', async ({ page }) => {
  await page.goto('/agents/threads');

  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList).toBeVisible();

  const firstThread = threadsList.locator('.cursor-pointer').first();
  await expect(firstThread).toBeVisible();
  await firstThread.click();
  await expect(page).toHaveURL(/\/agents\/threads\//);
  await expect(page.getByTestId('conversation')).toBeVisible();
  await argosScreenshot(page, 'threads-list-detail');
});

test('redirects root to /agents/threads', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/agents\/threads$/);
  await expect(page.getByTestId('threads-list')).toBeVisible();
  await argosScreenshot(page, 'threads-list-root-redirect');
});
