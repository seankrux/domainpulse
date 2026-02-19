import { test, expect } from '@playwright/test';

test.describe('Production Build Verification', () => {
  // Use a longer timeout for the production build
  test.setTimeout(60000);

  test('should pass end-to-end on the production build', async ({ page }) => {
    // 1. Navigate to the preview server
    // Note: 'npm run preview' usually runs on port 4173 by default in Vite, 
    // but we can also use port 3000 if we started it manually.
    // We'll check both or assume the standard 4173 for preview.
    await page.goto('http://localhost:4173');
    
    // Handle Login
    const passwordInput = page.locator('#password');
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('testpassword');
      await page.click('button[type="submit"]');
    }

    // 2. Verify Dashboard UI
    await expect(page.getByTestId('header-title')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('header-title')).toContainText('DomainPulse');

    // 3. Add a Domain and Verify Worker
    const uniqueDomain = `prod-verify-${Math.random().toString(36).slice(2, 7)}.com`;
    await page.fill('input[placeholder*="Enter domain"]', uniqueDomain);
    await page.click('button:has-text("Track")');

    // Wait for the row to appear
    const domainRow = page.locator(`tr:has-text("${uniqueDomain}")`);
    await expect(domainRow).toBeVisible();

    // 4. Verify Background Worker Logic
    // In production, the worker should update the status from 'Checking...' to a result
    await expect(domainRow.locator('text=Checking...')).toHaveCount(0, { timeout: 20000 });
    
    // Verify status cell is not empty and not 'Checking'
    const statusCell = domainRow.locator('td').nth(2);
    const statusText = await statusCell.textContent();
    expect(statusText?.trim()).not.toBe('Checking...');
    expect(statusText?.trim()).not.toBe('');

    // 5. Verify Chart Visibility
    await expect(page.locator('text=Health Distribution')).toBeVisible();

    // 6. Check for Console Errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Final screenshot for visual confirmation
    await page.screenshot({ path: 'production_build_verify.png', fullPage: true });
    
    expect(consoleErrors).not.toContain('Maximum update depth exceeded');
  });
});
