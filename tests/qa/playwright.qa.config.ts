import { defineConfig, devices } from '@playwright/test';

/**
 * Standalone Playwright config for the Form & Call QA engine integration tests.
 * Unlike the root config it does NOT start the app dev server — the QA tests
 * drive chromium directly against local file:// fixtures.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /qa\.integration\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
