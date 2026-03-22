import { test, expect } from '@playwright/test';

const defaultEmail = 'e2e-tester@agyn.test';
const expectedEmail = process.env.E2E_OIDC_EMAIL ?? defaultEmail;

test('signs in via mockauth redirect flow', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');

  await page.waitForURL(/mockauth\.dev\/r\/.*\/oidc\/login/);

  const loginHeading = page.getByRole('heading', { level: 1 });
  await expect(loginHeading).toContainText('Log in to');

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

  const storedUser = await page.evaluate(() => {
    let storageKey: string | null = null;
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('oidc.user:')) {
        storageKey = key;
        break;
      }
    }

    if (!storageKey) return null;
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      throw new Error(`Missing session storage entry for ${storageKey}`);
    }
    const parsed = JSON.parse(raw) as {
      access_token?: unknown;
      id_token?: unknown;
      profile?: { email?: unknown };
    };
    return {
      accessToken: typeof parsed.access_token === 'string' ? parsed.access_token : null,
      idToken: typeof parsed.id_token === 'string' ? parsed.id_token : null,
      email: typeof parsed.profile?.email === 'string' ? parsed.profile.email : null,
    };
  });

  expect(storedUser).not.toBeNull();
  expect(storedUser?.accessToken).toBeTruthy();
  expect(storedUser?.idToken).toBeTruthy();
  expect(storedUser?.email).toBe(expectedEmail);
});
