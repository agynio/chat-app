import type { Page } from '@playwright/test';
import { test, expect, isMocked } from './fixtures';

const threadOne = {
  id: '11111111-1111-1111-1111-111111111111',
  runMessages: [
    'Draft a Q2 marketing brief focused on the new launch.',
    'Here is a draft brief with positioning, goals, and launch phases.',
    'Add a section on creative deliverables and internal review dates.',
    'Updated draft includes a deliverables checklist and review cadence.',
  ],
};

async function openAnyThread(page: Page) {
  await page.goto('/agents/threads');
  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList).toBeVisible();
  await threadsList.locator('.cursor-pointer').first().click();
  await expect(page).toHaveURL(/\/agents\/threads\//);
}

test('shows thread runs', async ({ page }) => {
  if (isMocked) {
    await page.goto(`/agents/threads/${threadOne.id}`);
    const runInfo = page.getByTestId('run-info');
    await expect(runInfo).toHaveCount(2);
    await expect(runInfo.getByText('Running')).toBeVisible();
    await expect(runInfo.getByText('Finished')).toBeVisible();
    return;
  }

  await openAnyThread(page);
  await expect(page.getByTestId('conversation')).toBeVisible();
});

test('shows run messages', async ({ page }) => {
  if (isMocked) {
    await page.goto(`/agents/threads/${threadOne.id}`);
    const conversation = page.getByTestId('conversation');
    for (const message of threadOne.runMessages) {
      await expect(conversation.getByText(message)).toBeVisible();
    }
    return;
  }

  await openAnyThread(page);
  await expect(page.getByTestId('conversation')).toBeVisible();
});
