import { test as base, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-tester@agyn.test';
const skipOidc = process.env.E2E_SKIP_OIDC === 'true';

base.skip(skipOidc, 'MockAuth redirect URI not configured for localhost.');

base('unauthenticated access redirects to MockAuth login', async ({ page }) => {
  await page.goto('/agents/threads');
  await page.waitForURL(/mockauth\.dev.*\/oidc\/login/, { timeout: 15_000 });
  await expect(page.getByTestId('login-email-input')).toBeVisible();
});

base('login via MockAuth completes and returns to app', async ({ page }) => {
  await page.goto('/agents/threads');
  await page.waitForURL(/mockauth\.dev.*\/oidc\/login/, { timeout: 15_000 });

  await page.getByTestId('login-email-input').fill(TEST_EMAIL);
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL(/localhost:3000\/agents\/threads/, { timeout: 15_000 });
  await expect(page.getByTestId('threads-list')).toBeVisible({ timeout: 10_000 });
});
