import { test, expect } from '@playwright/test';

/**
 * Login portal E2E — runs ONLY against an auth-enabled instance
 * (VITE_PASSWORD_HASH set) with the plaintext password provided via
 * DP_E2E_PASSWORD. On public-demo instances (CI default: no hash) the whole
 * file self-skips, so this never breaks the login-less suite (AGENTS.md §7).
 *
 * Local run:
 *   DP_E2E_PASSWORD='your-password' npx playwright test tests/login.spec.ts
 */
const PASSWORD = process.env.DP_E2E_PASSWORD;

test.describe('login portal', () => {
  test.beforeEach(async ({ request }) => {
    const status = await request.get('/api/auth-status');
    const { authRequired } = await status.json();
    test.skip(!authRequired, 'auth not configured — public demo mode');
    test.skip(!PASSWORD, 'DP_E2E_PASSWORD not set');
  });

  test('gates the dashboard until the configured password is entered', async ({ page }) => {
    await page.goto('/');

    // Gate: login portal shown, dashboard hidden
    await expect(page.getByText('Sign in to access your dashboard')).toBeVisible();
    await expect(page.getByTestId('header-title')).not.toBeVisible();

    // Wrong password → error, still gated
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid password/i)).toBeVisible();

    // Correct password → dashboard
    await page.getByLabel('Password').fill(PASSWORD!);
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByTestId('header-title')).toBeVisible();

    // Session survives a reload (sessionStorage)
    await page.reload();
    await expect(page.getByTestId('header-title')).toBeVisible();

    // Sign out → back to the portal
    await page.getByTestId('logout-button').click();
    await expect(page.getByText('Sign in to access your dashboard')).toBeVisible();
  });
});
