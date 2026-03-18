import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function openAnyThread(page: Page) {
  await page.goto('/agents/threads');
  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList).toBeVisible();
  const firstThread = threadsList.locator('.cursor-pointer').first();
  await expect(firstThread).toBeVisible();
  await firstThread.click();
  await expect(page).toHaveURL(/\/agents\/threads\//);
}

test('shows thread runs', async ({ page }) => {
  await openAnyThread(page);
  const runInfo = page.getByTestId('run-info');
  await expect(runInfo.first()).toBeVisible();
});

test('shows run messages', async ({ page }) => {
  await openAnyThread(page);
  const messages = page.getByTestId('conversation-message');
  await expect(messages.first()).toBeVisible();
});
