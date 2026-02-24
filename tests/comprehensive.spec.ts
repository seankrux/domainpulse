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
    // 1. Wait for domain to be visible in the list
    const domainRow = page.locator(`tr:has-text("${uniqueDomain}")`);
    await expect(domainRow).toBeVisible();

    // 2. Get the actual status text from the row
    // The status is in the 3rd column (index 2)
    const statusText = await domainRow.locator('td').nth(2).textContent();
    const cleanStatus = statusText?.trim() || 'Unknown';
    
    // 3. Filter by the ACTUAL status
    // Note: If the status is "200 OK" or similar, we map it to "Alive" for the dropdown
    let filterOption = cleanStatus;
    if (cleanStatus.includes('200') || cleanStatus === 'Alive') filterOption = 'Alive';
    else if (cleanStatus === 'Down' || cleanStatus.includes('500') || cleanStatus.includes('404')) filterOption = 'Down';
    else if (cleanStatus === 'Checking...') filterOption = 'Unknown'; // Or handle Checking differently if needed
    else filterOption = 'Unknown';

    if (cleanStatus !== 'Checking...') {
        await page.selectOption('select:near(span:text("Status:"))', { label: filterOption });
        await expect(domainRow).toBeVisible();
        
        // 4. Filter by a DIFFERENT status
        const otherOption = filterOption === 'Alive' ? 'Down' : 'Alive';
        await page.selectOption('select:near(span:text("Status:"))', { label: otherOption });
        await expect(domainRow).not.toBeVisible();
    }
    
    // Reset to All
    await page.selectOption('select:near(span:text("Status:"))', { label: 'All' });

    // Group Filter
    // First, let's assign a group to our domain
    await domainRow.locator('button:has-text("Group")').click();
    await page.locator('button:has-text("Personal")').click();
    
    await page.selectOption('select:near(span:text("Group:"))', { label: 'Personal' });
    await expect(page.locator(`tr:has-text("${uniqueDomain}")`)).toBeVisible();
    
    await page.selectOption('select:near(span:text("Group:"))', { label: 'Production' });
    await expect(page.locator(`tr:has-text("${uniqueDomain}")`)).not.toBeVisible();
    await page.selectOption('select:near(span:text("Group:"))', { label: 'All' });
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
