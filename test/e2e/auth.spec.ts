import { test, expect } from './fixtures';

test('completes OIDC login and loads the app', async ({ page }) => {
  await expect(page).toHaveURL(/\/agents\/threads/);
  await expect(page.getByTestId('threads-list')).toBeVisible();
});
