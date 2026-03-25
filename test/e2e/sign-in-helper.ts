import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const defaultEmail = 'e2e-tester@agyn.test';

type SignInOptions = {
  onLoginPage?: (page: Page) => Promise<void>;
};

export async function signInViaMockAuth(
  page: Page,
  email?: string,
  options: SignInOptions = {},
): Promise<boolean> {
  const expectedEmail = email ?? process.env.E2E_OIDC_EMAIL ?? defaultEmail;

  await page.goto('/');

  const loginUrlPattern = /mockauth\.dev\/r\/.*\/oidc/;
  const chatList = page.getByTestId('chat-list');

  const initialRoute = await Promise.race([
    page
      .waitForURL(loginUrlPattern, { timeout: 10000 })
      .then(() => 'login')
      .catch(() => null),
    chatList
      .waitFor({ timeout: 10000 })
      .then(() => 'app')
      .catch(() => null),
  ]);

  if (initialRoute === 'app') {
    await expect(chatList).toBeVisible();
    return false;
  }

  if (!initialRoute) {
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
  await expect(chatList).toBeVisible({ timeout: 15000 });
  return true;
}
