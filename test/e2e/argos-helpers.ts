import { argosScreenshot as baseArgosScreenshot } from '@argos-ci/playwright';
import type { Page } from '@playwright/test';

const STABILITY_IDLE_MS = 300;
const STABILITY_TIMEOUT_MS = 5000;
const SCREENSHOT_RETRIES = 3;
const RETRY_DELAY_MS = 200;

function isNavigationError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  return (
    message.includes('Navigation interrupted') ||
    message.includes('Frame is currently attempting a navigation') ||
    message.includes('Cannot read properties of undefined (reading \'afterEach\')')
  );
}

async function waitForStablePage(page: Page): Promise<void> {
  let lastNavigation = Date.now();
  const handleNavigation = () => {
    lastNavigation = Date.now();
  };

  page.on('framenavigated', handleNavigation);
  try {
    await page.waitForLoadState('networkidle');
    const start = Date.now();
    while (Date.now() - lastNavigation < STABILITY_IDLE_MS) {
      const remaining = STABILITY_IDLE_MS - (Date.now() - lastNavigation);
      await page.waitForTimeout(Math.max(remaining, 50));
      if (Date.now() - start > STABILITY_TIMEOUT_MS) {
        break;
      }
    }
  } finally {
    page.off('framenavigated', handleNavigation);
  }
}

export async function argosScreenshot(page: Page, name: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < SCREENSHOT_RETRIES; attempt += 1) {
    try {
      await waitForStablePage(page);
      await baseArgosScreenshot(page, name);
      return;
    } catch (error) {
      if (!isNavigationError(error) || attempt === SCREENSHOT_RETRIES - 1) {
        throw error;
      }
      lastError = error;
      await page.waitForTimeout(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}
