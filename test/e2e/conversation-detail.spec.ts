import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function openAnyConversation(page: Page) {
  await page.goto('/conversations');
  const conversationsList = page.getByTestId('conversations-list');
  await expect(conversationsList).toBeVisible();
  const firstConversation = conversationsList.locator('.cursor-pointer').first();
  await expect(firstConversation).toBeVisible();
  await firstConversation.click();
  await expect(page).toHaveURL(/\/conversations\//);
}

test('shows conversation runs', async ({ page }) => {
  await openAnyConversation(page);
  const runInfo = page.getByTestId('run-info');
  await expect(runInfo.first()).toBeVisible();
  await argosScreenshot(page, 'conversation-detail-runs');
});

test('shows conversation messages', async ({ page }) => {
  await openAnyConversation(page);
  const messages = page.getByTestId('conversation-message');
  await expect(messages.first()).toBeVisible();
  await argosScreenshot(page, 'conversation-detail-messages');
});
