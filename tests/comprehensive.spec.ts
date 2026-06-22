import { test, expect } from '@playwright/test';

test.describe('Comprehensive DomainPulse Tests', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('http://localhost:3000');
    
    // Robust Login Sequence
    const passwordInput = page.locator('#password');
    if (await passwordInput.count() > 0) {
      await passwordInput.fill('testpassword');
      await page.click('button:has-text("Sign In")');
      
      // Check for error message
      const errorText = page.locator('text=Invalid password');
      if (await errorText.isVisible()) {
        throw new Error("LOGIN FAILED: 'testpassword' was rejected. Check VITE_PASSWORD_HASH in .env.local.");
      }
    }
    
    // Wait for "Loading..." screen to DISAPPEAR
    await page.waitForSelector('text=Loading...', { state: 'hidden', timeout: 30000 });
    
    // Ensure we reached the dashboard by waiting for header or title
    await expect(page.getByTestId('header-title')).toBeVisible({ timeout: 20000 });
    // Or check for the heading "Monitor your digital assets"
    await expect(page.locator('h2:has-text("Monitor your digital assets")')).toBeVisible({ timeout: 15000 });
  });

  test('settings cog should open settings panel', async ({ page }) => {
    await page.getByTestId('settings-button').click({ force: true });
    await expect(page.getByTestId('settings-panel')).toBeVisible();
    await expect(page.locator('text=Advanced Monitoring')).toBeVisible();
  });

  test('filters should work correctly', async ({ page }) => {
    const uniqueDomain = `filter-test-${Math.random().toString(36).slice(2, 7)}.com`;
    const input = page.locator('input[placeholder*="Enter domain to monitor"]');
    await input.fill(uniqueDomain);
    await page.click('button:has-text("Track")');

    await expect(page.locator(`tr:has-text("${uniqueDomain}")`)).toBeVisible({ timeout: 15000 });
    
    // Search Filter
    const searchInput = page.locator('input[placeholder*="Filter domains"]');
    await searchInput.fill(uniqueDomain);
    await expect(page.locator('tr')).toHaveCount(2); // Header + 1 Row
    
    await searchInput.fill('non-existent-domain-xyz.com');
    await expect(page.locator('text=No matching domains')).toBeVisible();
    await searchInput.clear();

    // Status Filter (Robust)
    // 1. Wait for domain row and for it to leave Checking state (max 15s)
    const domainRow = page.locator(`tr:has-text("${uniqueDomain}")`);
    await expect(domainRow).toBeVisible();
    await expect(domainRow.locator('td').nth(2)).not.toContainText('Checking...', { timeout: 15000 }).catch(() => {});

    // 2. Read the stable status text from the 3rd column (index 2)
    const statusText = await domainRow.locator('td').nth(2).textContent();
    const cleanStatus = statusText?.trim() || '';

    // 3. Map display text → filter dropdown value (covers all DomainStatus enum values)
    const statusValueMap: Record<string, string> = {
      'Alive': 'ALIVE', '200 OK': 'ALIVE',
      'Down': 'DOWN',
      'Unknown': 'UNKNOWN',
      'Error': 'ERROR',
    };
    // HTTP numeric codes (e.g. "301", "500") → Alive or Down based on range
    let filterValue: string | null = statusValueMap[cleanStatus] ?? null;
    if (!filterValue) {
      const code = parseInt(cleanStatus, 10);
      if (!isNaN(code)) filterValue = code < 400 ? 'ALIVE' : 'DOWN';
    }

    if (filterValue && cleanStatus !== 'Checking...') {
        await page.selectOption('[data-testid="status-filter"]', { value: filterValue });
        await expect(domainRow).toBeVisible({ timeout: 5000 });

        // 4. Filter by a DIFFERENT status that definitely excludes this domain
        const otherValue = filterValue === 'ALIVE' ? 'DOWN' : 'ALIVE';
        await page.selectOption('[data-testid="status-filter"]', { value: otherValue });
        await expect(domainRow).not.toBeVisible();
    }

    // Reset to All
    await page.selectOption('[data-testid="status-filter"]', { value: 'ALL' });

    // Group Filter
    // First, let's assign a group to our domain
    await domainRow.locator('button[title="Change Group"]').click();
    // dispatchEvent bypasses animate-in instability on the GroupPicker
    await page.locator('button:has-text("Personal")').first().dispatchEvent('click');

    // Group option labels include counts "Personal (N)" — find value by partial text match
    const personalVal = await page.locator('[data-testid="group-filter"] option').filter({ hasText: 'Personal' }).first().getAttribute('value');
    await page.selectOption('[data-testid="group-filter"]', personalVal!);
    await expect(page.locator(`tr:has-text("${uniqueDomain}")`)).toBeVisible();

    const productionVal = await page.locator('[data-testid="group-filter"] option').filter({ hasText: 'Production' }).first().getAttribute('value');
    await page.selectOption('[data-testid="group-filter"]', productionVal!);
    await expect(page.locator(`tr:has-text("${uniqueDomain}")`)).not.toBeVisible();
    await page.selectOption('[data-testid="group-filter"]', { value: 'ALL' });
  });

  test('group management should work', async ({ page }) => {
    const groupName = `Group-${Math.random().toString(36).slice(2, 7)}`;
    
    await page.click('button[title="Manage Groups"]');
    await page.waitForTimeout(1000); // Wait for modal animation
    
    const modal = page.getByTestId('group-manager-modal');
    await expect(modal).toBeVisible();
    
    // Click "Add New Group" first to show the input
    await modal.locator('button:has-text("Add New Group")').click();
    await page.waitForTimeout(500);
    
    const groupNameInput = modal.locator('input[placeholder*="Production, Personal"]');
    await groupNameInput.fill(groupName);
    await modal.locator('button:has-text("Save Group")').click();
    
    await expect(modal).toContainText(groupName);
    await modal.locator('button').filter({ has: page.locator('svg') }).first().click(); // Close modal using X button if needed, but let's stick to the Close text if it exists
  });

  test('Domain detail modal should show on click', async ({ page }) => {
    const detailDomain = `detail-${Math.random().toString(36).slice(2, 7)}.com`;
    const input = page.locator('input[placeholder*="Enter domain to monitor"]');
    await input.fill(detailDomain);
    await page.click('button:has-text("Track")');

    const domainLink = page.getByTestId(`domain-link-${detailDomain}`);
    await expect(domainLink).toBeVisible({ timeout: 15000 });
    
    await domainLink.click({ force: true });
    
    const detailModal = page.getByTestId('detail-modal');
    await expect(detailModal).toBeVisible({ timeout: 10000 });
    await expect(detailModal.locator('h2')).toContainText(detailDomain);
    await expect(detailModal.locator('h3:has-text("SSL Certificate")')).toBeVisible();
    
    await detailModal.locator('button:has-text("Close")').click();
    await expect(detailModal).not.toBeVisible();
  });
});
