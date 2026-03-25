import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const defaultEmail = 'e2e-tester@agyn.test';

type SignInOptions = {
  onLoginPage?: (page: Page) => Promise<void>;
  force?: boolean;
};

async function clearAuthState(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });
  await page.context().clearCookies();
}

export async function signInViaMockAuth(
  page: Page,
  email?: string,
  options: SignInOptions = {},
): Promise<boolean> {
  const expectedEmail = email ?? process.env.E2E_OIDC_EMAIL ?? defaultEmail;
  const forceLogin = options.force ?? false;

  await page.goto('/');
  if (forceLogin) {
    await clearAuthState(page);
    await page.goto('/');
  }

  const loginUrlPattern = /mockauth\.dev\/r\/.*\/oidc/;
  const chatList = page.getByTestId('chat-list');
  const noOrganizationsScreen = page.getByTestId('no-organizations-screen');
  const emptyChatState = page.getByText(/No chats (available yet|match the current filter)/);
  const appReady = chatList.or(noOrganizationsScreen).or(emptyChatState);

  const initialRoute = await Promise.race([
    page
      .waitForURL(loginUrlPattern, { timeout: 10000 })
      .then(() => 'login')
      .catch(() => null),
    appReady
      .waitFor({ timeout: 10000 })
      .then(() => 'app')
      .catch(() => null),
  ]);

  if (initialRoute === 'app' && !forceLogin) {
    await expect(appReady).toBeVisible();
    return false;
  }

  if (!initialRoute || (initialRoute === 'app' && forceLogin)) {
    await page.waitForURL(loginUrlPattern, { timeout: 15000 });
  }

  if (options.onLoginPage) {
    await options.onLoginPage(page);
  }

  const strategyTabs = page.getByTestId('login-strategy-tabs');
  if (await strategyTabs.isVisible()) {
    await strategyTabs.getByRole('tab', { name: 'Email' }).click();
  }

  const emailInput = page.getByTestId('login-email-input');
  await expect(emailInput).toBeVisible();
  await emailInput.fill(expectedEmail);

  await page.getByRole('button', { name: 'Continue' }).click();

  await page.waitForURL(/\/chats/);
  await expect(appReady).toBeVisible({ timeout: 30000 });
  return true;
}
