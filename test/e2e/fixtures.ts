import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';
import { acquireOidcTokens } from './auth-helper';
export { expect };

async function injectAuthAndLoad(page: Page) {
  const { storageKey, userJson } = await acquireOidcTokens();

  await page.addInitScript(
    ({ key, value }) => {
      window.sessionStorage.setItem(key, value);
    },
    { key: storageKey, value: userJson },
  );

  await page.goto('/');
  await page.waitForURL(/\/agents\/threads/, { timeout: 30000 });
  await page.getByTestId('threads-list').waitFor();
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
    await injectAuthAndLoad(page);
    await runPage(page);
  },
});
