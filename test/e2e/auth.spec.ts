import { test, expect } from './fixtures';

const defaultEmail = 'e2e-tester@agyn.test';
const expectedEmail = process.env.E2E_OIDC_EMAIL ?? defaultEmail;

test('exposes oidc user profile in session storage', async ({ page }) => {
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
      profile?: { email?: unknown };
    };
    return {
      accessToken: typeof parsed.access_token === 'string' ? parsed.access_token : null,
      email: typeof parsed.profile?.email === 'string' ? parsed.profile.email : null,
    };
  });

  expect(storedUser).not.toBeNull();
  expect(storedUser?.accessToken).toBeTruthy();
  expect(storedUser?.email).toBe(expectedEmail);
});
