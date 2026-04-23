import * as crypto from 'node:crypto';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

const defaultEmail = 'e2e-tester@agyn.test';
const E2E_IDENTITY_STORAGE_KEY = 'e2e.identity';
const useMockBackend = ['1', 'true', 'yes'].includes((process.env.E2E_USE_MOCKS ?? '').toLowerCase());

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

function buildMockIdentity(email: string) {
  const rawName = email.split('@')[0] ?? email;
  const name = rawName.replace(/[._-]+/g, ' ').trim() || email;
  return {
    id: crypto.randomUUID(),
    email,
    name,
  };
}

async function ensureMockIdentity(page: Page, email: string, force: boolean): Promise<void> {
  const existing = await page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { id?: string; email?: string; name?: string };
      if (!parsed || typeof parsed.id !== 'string') return null;
      if (typeof parsed.email !== 'string' || typeof parsed.name !== 'string') return null;
      return parsed;
    } catch (_error) {
      return null;
    }
  }, E2E_IDENTITY_STORAGE_KEY);

  if (!force && existing && existing.email === email) {
    return;
  }

  const identity = buildMockIdentity(email);
  await page.evaluate(
    ({ key, identity: next }) => {
      window.localStorage.setItem(key, JSON.stringify(next));
    },
    { key: E2E_IDENTITY_STORAGE_KEY, identity },
  );
}

async function enableMockFlags(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__E2E_MOCKS__ = true;
  });
  await page.evaluate(() => {
    window.__E2E_MOCKS__ = true;
  });
}

export async function signInViaMockAuth(
  page: Page,
  email?: string,
  options: SignInOptions = {},
): Promise<boolean> {
  const expectedEmail = email ?? process.env.E2E_OIDC_EMAIL ?? defaultEmail;
  const forceLogin = options.force ?? false;

  if (useMockBackend) {
    await enableMockFlags(page);
    await page.goto('/');
    if (forceLogin) {
      await clearAuthState(page);
      await enableMockFlags(page);
      await page.goto('/');
    }
    await ensureMockIdentity(page, expectedEmail, forceLogin);
    await page.reload();
    await enableMockFlags(page);

    const chatList = page.getByTestId('chat-list');
    const noOrganizationsScreen = page.getByTestId('no-organizations-screen');
    const appReady = chatList.or(noOrganizationsScreen);
    await expect(appReady).toBeVisible({ timeout: 30000 });
    return false;
  }

  await page.goto('/');
  if (forceLogin) {
    await clearAuthState(page);
    await page.goto('/');
  }

  const loginUrlPattern = /mockauth\.dev\/r\/.*\/oidc/;
  const chatList = page.getByTestId('chat-list');
  const noOrganizationsScreen = page.getByTestId('no-organizations-screen');
  const appReady = chatList.or(noOrganizationsScreen);

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
    await expect(appReady).toBeVisible({ timeout: 30000 });
    return false;
  }

  if (!initialRoute || (initialRoute === 'app' && forceLogin)) {
    const loginReached = await page
      .waitForURL(loginUrlPattern, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (!loginReached) {
      await expect(appReady).toBeVisible({ timeout: 30000 });
      return false;
    }
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
