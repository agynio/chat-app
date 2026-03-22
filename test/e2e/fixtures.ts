import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';
export { expect };

const defaultEmail = 'e2e-tester@agyn.test';
const expectedEmail = process.env.E2E_OIDC_EMAIL ?? defaultEmail;

async function signInAndLoad(page: Page) {
  await page.goto('/');

  await page.waitForURL(/mockauth\.dev\/r\/.*\/oidc\/login/);

  const strategyTabs = page.getByTestId('login-strategy-tabs');
  if (await strategyTabs.isVisible()) {
    await strategyTabs.getByRole('tab', { name: 'Email' }).click();
  }

  const emailInput = page.getByTestId('login-email-input');
  await expect(emailInput).toBeVisible();
  await emailInput.fill(expectedEmail);

  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL(/\/agents\/threads/);
  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList).toBeVisible();
}

export const test = base.extend({
  page: async ({ page }, runPage) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('[browser-error]', msg.text());
      }
    });
    page.on('requestfailed', (request) => {
      console.log(
        `[request-failed] ${request.url()} — ${request.failure()?.errorText}`,
      );
    });
    await signInAndLoad(page);
    await runPage(page);
  },
});
