import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';
import { acquireOidcTokens } from './auth-helper';

export { expect };

type Fixtures = {
  authenticatedPage: Page;
};

async function injectAuthAndLoad(page: Page) {
  const { storageKey, userJson } = await acquireOidcTokens();

  console.log('[e2e-auth] storageKey:', storageKey);
  console.log('[e2e-auth] userJson length:', userJson.length);

  await page.addInitScript(
    ({ key, value }) => {
      try {
        window.sessionStorage.setItem(key, value);
        console.log('[init-script] set sessionStorage key:', key);
        console.log('[init-script] sessionStorage keys:', Object.keys(window.sessionStorage));
      } catch (e) {
        console.error('[init-script] failed to set sessionStorage:', e);
      }
    },
    { key: storageKey, value: userJson },
  );

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('net::ERR_ABORTED') && !message.includes('Navigation interrupted')) {
      throw error;
    }
    console.log('[e2e-auth] goto got ERR_ABORTED, checking current URL:', page.url());
  }
  await page.waitForURL(/\/agents\/threads/, { timeout: 30000 });
  await page.getByTestId('threads-list').waitFor();
}

export const test = base.extend<Fixtures>({
  page: async ({ page }, runPage) => {
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error') {
        console.log('[browser-error]', text);
        return;
      }
      if (text.includes('[init-script]')) {
        console.log(text);
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
  authenticatedPage: async ({ page }, runAuthenticatedPage) => {
    await runAuthenticatedPage(page);
  },
});
