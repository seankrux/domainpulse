import { test, expect } from '@playwright/test';

test.describe('DomainPulse Dashboard', () => {
  test('should load dashboard and add a domain', async ({ page }) => {
    // Increase timeout for server startup and worker processing
    test.setTimeout(60000);

    await page.goto('/');
    
    // Handle Login if present
    const passwordInput = page.locator('input[id="password"]');
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('testpassword');
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForSelector('[data-testid="header-title"]');
    }

    // 1. Verify Header
    await expect(page.getByTestId('header-title')).toContainText('DomainPulse', { timeout: 15000 });

    // 2. Verify Domain Addition
    const input = page.locator('input[placeholder*="Enter domain to monitor"]');
    await input.fill('example.com');
    await page.click('button:has-text("Track")');

    // 3. Verify Table Entry
    const domainRow = page.locator('tr:has-text("example.com")');
    await expect(domainRow).toBeVisible();

    // 4. Verify Chart Stability (Phase 1 Fix)
    const chart = page.locator('text=Health Distribution');
    await expect(chart).toBeVisible();

    // 5. Verify Background Worker Result
    // Wait for "Checking..." to disappear and status to update
    await expect(domainRow.locator('text=Checking...')).toHaveCount(0, { timeout: 20000 });
    
    // Status should now be a status code or "Alive"
    const statusCell = domainRow.locator('td').nth(2);
    await expect(statusCell).not.toHaveText('Checking...');
  });
});
