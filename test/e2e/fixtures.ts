import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

export { expect };

const vitestMatchersSymbol = Symbol.for('matchers-object');
if (!Object.prototype.hasOwnProperty.call(globalThis, vitestMatchersSymbol)) {
  Object.defineProperty(globalThis, vitestMatchersSymbol, {
    value: new WeakMap<object, unknown>(),
  });
}

type Fixtures = {
  authenticatedPage: Page;
};

async function loginWithMockAuth(page: Page) {
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
  try {
    await page.goto('/', { waitUntil: 'commit' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (
      !message.includes('net::ERR_ABORTED') &&
      !message.includes('Navigation interrupted') &&
      !message.includes('Target page, context or browser has been closed')
    ) {
      throw error;
    }
  }
  await page.waitForURL(/mockauth\.dev|\/agents\/threads/, { timeout: 30000 });

  if (page.url().includes('mockauth.dev')) {
    const emailInput = page.getByTestId('login-email-input');
    await emailInput.waitFor({ timeout: 15000 });
    await emailInput.fill('e2e-tester@agyn.test');

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(/\/agents\/threads/);
  }
  await page.getByTestId('threads-list').waitFor();
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, runPage) => {
    await loginWithMockAuth(page);
    await runPage(page);
  },
  authenticatedPage: async ({ page }, runAuthenticatedPage) => {
    await runAuthenticatedPage(page);
  },
});
