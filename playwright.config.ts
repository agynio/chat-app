import { createArgosReporterOptions } from '@argos-ci/playwright/reporter';
import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL;
const isCI = Boolean(process.env.CI);
const argosToken = process.env.ARGOS_TOKEN;
const hasArgosToken = Boolean(argosToken && argosToken.length === 40);

if (!BASE_URL) {
  throw new Error(
    'E2E_BASE_URL is required. Run tests via: devspace run test:e2e\n' +
      'Or set E2E_BASE_URL manually to the app URL (e.g., http://chat-app:3000).',
  );
}

export default defineConfig({
  testDir: './test/e2e',
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 1,
  workers: 2,
  reporter: [
    isCI ? ['dot'] : ['list'],
    ['html', { open: 'never' }],
    ...(hasArgosToken
      ? [
          [
            '@argos-ci/playwright/reporter',
            createArgosReporterOptions({
              ignoreUploadFailures: true,
              uploadToArgos: isCI,
            }),
          ],
        ]
      : []),
  ],
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--ignore-certificate-errors'],
        },
      },
    },
  ],
});
