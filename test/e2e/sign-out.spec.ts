import { argosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';

async function readOidcSessionKey(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('oidc.user:')) {
        return key;
      }
    }
    return null;
  });
}

async function openUserMenu(page: Page) {
  const trigger = page.getByTestId('user-menu-trigger');
  await expect(trigger).toBeVisible({ timeout: 15000 });
  await trigger.click({ force: true });
  const signOutItem = page.getByRole('menuitem', { name: 'Sign out' });
  if (!(await signOutItem.isVisible())) {
    await trigger.click({ force: true });
  }
  await expect(signOutItem).toBeVisible({ timeout: 15000 });
  return signOutItem;
}

test('sign out clears oidc session storage', async ({ page }) => {
  test.setTimeout(60000);

  const sessionKey = await readOidcSessionKey(page);
  expect(sessionKey).not.toBeNull();

  const signOutItem = await openUserMenu(page);
  await signOutItem.click({ noWaitAfter: true });

  const sessionCleared = await page.waitForFunction(() => {
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith('oidc.user:')) {
        return false;
      }
    }
    return true;
  }, { timeout: 20000 });

  expect(await sessionCleared.jsonValue()).toBe(true);

  await page.waitForLoadState('networkidle');
  await argosScreenshot(page, 'sign-out-complete');
});
