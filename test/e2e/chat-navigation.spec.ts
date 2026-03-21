import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

function chatNavButton(page: Page) {
  const navigation = page.getByRole('navigation');
  return navigation.getByRole('button', { name: 'Chat' }).nth(1);
}

test('navigates to chat via sidebar', async ({ page }) => {
  await page.goto('/agents/threads');

  const chatButton = chatNavButton(page);
  await expect(chatButton).toBeVisible();
  await chatButton.click();

  await expect(page).toHaveURL(/\/agents\/chat$/);
});

test('navigates to chat via direct URL', async ({ page }) => {
  await page.goto('/agents/chat');

  await expect(page.getByTestId('chat-list')).toBeVisible();
});

test('sidebar shows Chat as active', async ({ page }) => {
  await page.goto('/agents/chat');

  const chatButton = chatNavButton(page);
  await expect(chatButton).toBeVisible();
  await expect(chatButton).toHaveClass(/bg-\[var\(--agyn-bg-accent\)\]/);
});
