import type { Page } from '@playwright/test';
import { test as base, expect } from '@playwright/test';
import { attachMockBackend, resetMockBackend } from './mock-backend';
import { signInViaMockAuth } from './sign-in-helper';
export { expect };

const useMockBackend = ['1', 'true', 'yes'].includes((process.env.E2E_USE_MOCKS ?? '').toLowerCase());
if (useMockBackend) {
  console.log('[mock-backend] fixtures enabled');
}

async function signInAndLoad(page: Page) {
  await signInViaMockAuth(page);
}

export const test = base.extend({
  page: async ({ page }, runPage) => {
    if (useMockBackend) {
      await attachMockBackend(page.context());
    }
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

if (useMockBackend) {
  test.beforeEach(() => {
    resetMockBackend();
  });
}
