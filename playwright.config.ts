import { defineConfig } from '@playwright/test';

import type { Options } from './e2e/support/fixtures';

/**
 * End-to-end tests on the Expo web build against the local Supabase stack.
 * Every flow runs once per salon type: `--project=gents` / `--project=ladies`.
 * Start the database first: `npx supabase start`.
 */
const PORT = Number(process.env.E2E_PORT ?? 8081);

export default defineConfig<Options>({
  testDir: 'e2e',
  globalSetup: './e2e/support/global-setup.ts',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: Number(process.env.E2E_WORKERS ?? 3),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    locale: 'en-US',
    timezoneId: 'Asia/Dubai',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'gents', use: { mode: 'gents' } },
    { name: 'ladies', use: { mode: 'ladies' } },
  ],
  webServer: {
    command: `EXPO_OFFLINE=1 BROWSER=none npx expo start --web --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
