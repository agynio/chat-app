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

  await page.route(/mockauth\.dev/, (route) => route.abort());

  await page.addInitScript(
    ({ key, value }) => {
      window.sessionStorage.setItem(key, value);
    },
    { key: storageKey, value: userJson },
  );

  try {
    await page.goto('/', { waitUntil: 'commit' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('net::ERR_ABORTED') && !message.includes('Navigation interrupted')) {
      throw error;
    }
  }

  const currentUrl = page.url();
  console.log('[e2e-auth] after first goto, URL:', currentUrl);
  const baseUrl = process.env.E2E_BASE_URL;
  if (baseUrl) {
    const expectedOrigin = new URL(baseUrl).origin;
    let actualOrigin: string | null = null;
    try {
      actualOrigin = new URL(currentUrl).origin;
    } catch {
      actualOrigin = null;
    }
    if (actualOrigin !== expectedOrigin) {
      throw new Error(`Expected to be on ${expectedOrigin} but got: ${currentUrl}`);
    }
  }

  await page.unrouteAll();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/agents\/threads/, { timeout: 30000 });
  await page.getByTestId('threads-list').waitFor();
}

export const test = base.extend<Fixtures>({
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
  authenticatedPage: async ({ page }, runAuthenticatedPage) => {
    await runAuthenticatedPage(page);
  },
});
