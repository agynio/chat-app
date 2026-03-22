import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const defaultEmail = 'e2e-tester@agyn.test';
const defaultAuthority = 'https://mockauth.dev/r/301ebb13-15a8-48f4-baac-e3fa25be29fc/oidc';
const oidcAuthority = process.env.E2E_OIDC_AUTHORITY ?? defaultAuthority;
const loginUrlPattern = buildLoginUrlPattern(oidcAuthority);

type SignInOptions = {
  onLoginPage?: (page: Page) => Promise<void>;
};

export async function signInViaMockAuth(
  page: Page,
  email?: string,
  options: SignInOptions = {},
) {
  const expectedEmail = email ?? process.env.E2E_OIDC_EMAIL ?? defaultEmail;

  await page.goto('/');

  await page.waitForURL(loginUrlPattern);

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

  await page.waitForURL(/\/agents\/threads/);
  const threadsList = page.getByTestId('threads-list');
  await expect(threadsList).toBeVisible();
}

function buildLoginUrlPattern(authority: string): RegExp {
  const authorityUrl = new URL(authority);
  const trimmedPath = authorityUrl.pathname.replace(/\/+$/g, '');
  const loginPath = `${trimmedPath}/login`;
  const origin = `${authorityUrl.protocol}//${authorityUrl.host}`;
  const pattern = `${escapeRegExp(origin)}${escapeRegExp(loginPath)}`;
  return new RegExp(`${pattern}.*`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
