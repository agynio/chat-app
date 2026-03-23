import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';
import { signInViaMockAuth } from './sign-in-helper';

const USER_A_EMAIL = 'e2e-user-a@agyn.test';
const USER_B_EMAIL = 'e2e-user-b@agyn.test';

type MultiUserFixtures = {
  userAPage: Page;
  userBPage: Page;
};

export const test = base.extend<MultiUserFixtures>({
  userAPage: async ({ browser }, use) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[browser-error]', msg.text());
    });
    page.on('requestfailed', (request) => {
      console.log(`[request-failed] ${request.url()} — ${request.failure()?.errorText}`);
    });
    await signInViaMockAuth(page, USER_A_EMAIL);
    await use(page);
    await context.close();
  },

  userBPage: async ({ browser }, use) => {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[browser-error]', msg.text());
    });
    page.on('requestfailed', (request) => {
      console.log(`[request-failed] ${request.url()} — ${request.failure()?.errorText}`);
    });
    await signInViaMockAuth(page, USER_B_EMAIL);
    await use(page);
    await context.close();
  },
});

export { expect, USER_A_EMAIL, USER_B_EMAIL };
