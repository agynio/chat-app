import { argosScreenshot } from '@argos-ci/playwright';
import { test, expect } from './fixtures';

test('renders conversation list on load', async ({ page }) => {
  await page.goto('/conversations');

  const conversationsList = page.getByTestId('conversations-list');
  await expect(conversationsList).toBeVisible();
  await expect(conversationsList.locator('.cursor-pointer').first()).toBeVisible();
  await argosScreenshot(page, 'conversations-list-loaded');
});

test('navigates to conversation detail', async ({ page }) => {
  await page.goto('/conversations');

  const conversationsList = page.getByTestId('conversations-list');
  await expect(conversationsList).toBeVisible();

  const firstConversation = conversationsList.locator('.cursor-pointer').first();
  await expect(firstConversation).toBeVisible();
  await firstConversation.click();
  await expect(page).toHaveURL(/\/conversations\//);
  await expect(page.getByTestId('conversation')).toBeVisible();
  await argosScreenshot(page, 'conversations-list-detail');
});

test('redirects root to /conversations', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/conversations$/);
  await expect(page.getByTestId('conversations-list')).toBeVisible();
  await argosScreenshot(page, 'conversations-list-root-redirect');
});
