import { test as base, expect } from '@playwright/test';

const TEST_EMAIL = 'e2e-tester@agyn.test';
const SKIP_OIDC = process.env.E2E_SKIP_OIDC === 'true';

export const test = base.extend({
  page: async ({ page }, runPage) => {
    await page.goto('/');

    if (SKIP_OIDC) {
      await expect(page.getByTestId('threads-list')).toBeVisible({ timeout: 10_000 });
      await runPage(page);
      return;
    }

    await page.waitForURL(/mockauth\.dev.*\/oidc\/login/, { timeout: 15_000 });

    await page.getByTestId('login-email-input').fill(TEST_EMAIL);
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.waitForURL(/localhost:3000/, { timeout: 15_000 });

    await expect(page.getByTestId('threads-list')).toBeVisible({ timeout: 10_000 });

    await runPage(page);
  },
});

export { expect };
