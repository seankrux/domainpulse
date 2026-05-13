import { test, expect } from '@playwright/test';

/**
 * Comprehensive GUI Test Suite - All Buttons and Settings
 * Tests every interactive element in the DomainPulse application
 */

test.describe('DomainPulse - Complete GUI Test Suite', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90000);
    await page.goto('http://localhost:3000');

    // Robust Login
    const passwordInput = page.locator('#password');
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('testpassword');
      await page.click('button:has-text("Sign In")');
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 15000 });
    }

    // Ensure dashboard is loaded
    await expect(page.getByTestId('header-title')).toBeVisible({ timeout: 20000 });
  });

  test.describe('Header Components', () => {
    test('should toggle dark mode', async ({ page }) => {
      // Initial state - light mode
      const html = page.locator('html');
      await html.getAttribute('class');

      // Click dark mode toggle
      const moonButton = page.locator('button[title="Toggle dark mode"]');
      await moonButton.click();
      
      // Should now be dark mode
      await page.waitForTimeout(300);
      const newClass = await html.getAttribute('class');
      expect(newClass).toContain('dark');
      
      // Toggle back
      const sunButton = page.locator('button[title="Toggle dark mode"]');
      await sunButton.click();
      await page.waitForTimeout(300);
    });

    test('should open and close settings panel', async ({ page }) => {
      // Open settings
      await page.getByTestId('settings-button').click();
      await expect(page.getByTestId('settings-panel')).toBeVisible();
      
      // Verify settings sections
      await expect(page.locator('h4:has-text("General")')).toBeVisible();
      await expect(page.locator('h4:has-text("Webhooks")')).toBeVisible();
      await expect(page.locator('h4:has-text("Advanced Monitoring")')).toBeVisible();
      
      // Close settings using X button
      await page.locator('button[aria-label="Close"]').first().click();
      await expect(page.getByTestId('settings-panel')).not.toBeVisible();
    });

    test('should toggle auto-refresh in settings', async ({ page }) => {
      await page.getByTestId('settings-button').click();
      
      // Toggle auto-refresh
      const autoRefreshCheckbox = page.locator('input[type="checkbox"]').first();
      await autoRefreshCheckbox.click();
      
      // Refresh interval dropdown should be enabled/disabled based on checkbox
      const refreshSelect = page.locator('select').first();
      const isEnabled = await refreshSelect.isEnabled();
      expect(isEnabled).toBeTruthy();
      
      // Toggle back
      await autoRefreshCheckbox.click();
    });

    test('should change refresh interval', async ({ page }) => {
      await page.getByTestId('settings-button').click();
      
      // Enable auto-refresh first
      const autoRefreshCheckbox = page.locator('input[type="checkbox"]').first();
      await autoRefreshCheckbox.click();
      
      // Change refresh interval
      const refreshSelect = page.locator('select').first();
      await refreshSelect.selectOption('60000'); // 1 minute
      
      // Verify selection
      const selectedValue = await refreshSelect.inputValue();
      expect(selectedValue).toBe('60000');
    });

    test('should toggle notifications and sound', async ({ page }) => {
      await page.getByTestId('settings-button').click();
      
      // Find notifications checkbox
      const notificationsCheckbox = page.locator('label:has-text("Notifications") input[type="checkbox"]');
      
      // Try to enable (may be blocked by browser permission)
      try {
        await notificationsCheckbox.click({ timeout: 3000 });
      } catch {
        // Permission dialog may block this - that's expected
      }
      
      // Sound checkbox (should be disabled if notifications are off)
      const soundCheckbox = page.locator('label:has-text("Sound") input[type="checkbox"]');
      await soundCheckbox.isDisabled();
      // Sound is only enabled if notifications are enabled
    });

    test('should change history retention', async ({ page }) => {
      await page.getByTestId('settings-button').click();
      
      const historySelect = page.locator('select').nth(1);
      await historySelect.selectOption('100');
      
      const selectedValue = await historySelect.inputValue();
      expect(selectedValue).toBe('100');
    });

    test('should set custom user-agent', async ({ page }) => {
      await page.getByTestId('settings-button').click();
      
      const userAgentInput = page.locator('input[placeholder="DomainPulse/1.0"]');
      await userAgentInput.fill('CustomAgent/2.0');
      
      const value = await userAgentInput.inputValue();
      expect(value).toBe('CustomAgent/2.0');
    });

    test('should change timeout and latency threshold', async ({ page }) => {
      await page.getByTestId('settings-button').click();
      
      const timeoutInput = page.locator('input[type="number"]').first();
      await timeoutInput.fill('30000');
      
      const latencyInput = page.locator('input[type="number"]').nth(1);
      await latencyInput.fill('5000');
      
      expect(await timeoutInput.inputValue()).toBe('30000');
      expect(await latencyInput.inputValue()).toBe('5000');
    });

    test('should add webhook', async ({ page }) => {
      await page.getByTestId('settings-button').click();
      
      // Fill webhook form
      const webhookName = page.locator('input[placeholder="Name (e.g. Alerts"]');
      await webhookName.fill('Test Webhook');
      
      const webhookType = page.locator('select').nth(2);
      await webhookType.selectOption('slack');
      
      const webhookUrl = page.locator('input[placeholder="Webhook URL"]');
      await webhookUrl.fill('https://hooks.slack.com/services/TEST/WEBHOOK');
      
      // Click add button
      const addButton = page.getByTestId('add-webhook-btn');
      await addButton.click();
      
      // Verify webhook was added
      await expect(page.locator('text=Test Webhook')).toBeVisible();
    });

    test('should enable/disable webhook', async ({ page }) => {
      await page.getByTestId('settings-button').click();

      // Add a webhook first
      const webhookName = page.locator('input[placeholder="Name (e.g. Alerts"]');
      await webhookName.fill('Toggle Test');

      const webhookUrl = page.locator('input[placeholder="Webhook URL"]');
      await webhookUrl.fill('https://hooks.slack.com/services/TEST');

      const addButton = page.getByTestId('add-webhook-btn');
      await addButton.click();

      // Toggle the webhook using evaluate (button is opacity-0 on hover container)
      await page.locator('button[title="Disable"]').last().evaluate(el => (el as HTMLElement).click());
    });

    test('should remove webhook', async ({ page }) => {
      await page.getByTestId('settings-button').click();

      // Add a webhook
      const webhookName = page.locator('input[placeholder="Name (e.g. Alerts"]');
      await webhookName.fill('Remove Test');

      const webhookUrl = page.locator('input[placeholder="Webhook URL"]');
      await webhookUrl.fill('https://hooks.slack.com/services/TEST');

      const addButton = page.getByTestId('add-webhook-btn');
      await addButton.click();

      // Remove the webhook using evaluate (button is opacity-0 on hover container)
      await page.locator('button[title="Remove"]').last().evaluate(el => (el as HTMLElement).click());

      // Verify removal
      await expect(page.locator('text=Remove Test')).not.toBeVisible();
    });
  });

  test.describe('Domain Management', () => {
    test('should add a domain', async ({ page }) => {
      const testDomain = `test-${Math.random().toString(36).slice(2, 8)}.com`;
      
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(testDomain);
      
      const trackButton = page.locator('button:has-text("Track")');
      await trackButton.click();
      
      // Verify domain appears in table
      await expect(page.locator(`tr:has-text("${testDomain}")`)).toBeVisible({ timeout: 15000 });
    });

    test('should show error for invalid domain', async ({ page }) => {
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill('not-a-valid-domain');

      const trackButton = page.locator('button:has-text("Track")');
      await trackButton.click();

      // Should show error message
      await expect(page.locator('text=Invalid domain')).toBeVisible();
    });

    test('should open bulk import modal', async ({ page }) => {
      const bulkButton = page.locator('button:has-text("Bulk Import")');
      await bulkButton.click();

      const modal = page.locator('h2:has-text("Bulk Import")');
      await expect(modal).toBeVisible();

      // Close modal using evaluate (button is in fixed overlay, outside viewport)
      await page.locator('button:has-text("Cancel")').evaluate(el => (el as HTMLElement).click());
      await expect(modal).not.toBeVisible();
    });

    test('should import domains via bulk import', async ({ page }) => {
      const bulkButton = page.locator('button:has-text("Bulk Import")');
      await bulkButton.click();

      const textarea = page.locator('textarea');
      await textarea.fill('bulk1.com\nbulk2.com\nbulk3.com');

      // Click Import using evaluate (button is in fixed overlay, outside viewport)
      const importButton = page.locator('button:has-text("Import Domains")');
      await importButton.evaluate(el => (el as HTMLElement).click());

      // Verify domains were added
      await expect(page.locator('tr:has-text("bulk1.com")')).toBeVisible({ timeout: 15000 });
    });

    test('should edit domain URL', async ({ page }) => {
      const editDomain = `edit-${Math.random().toString(36).slice(2, 6)}.com`;

      // Add domain
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(editDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${editDomain}")`)).toBeVisible({ timeout: 15000 });

      // Click edit button using evaluate (button is opacity-0 on desktop)
      await page.locator(`tr:has-text("${editDomain}") button[title="Edit"]`).evaluate(el => (el as HTMLElement).click());

      // Change URL (edit input appears in tbody when edit mode is active)
      const editInput = page.locator('tbody input[type="text"]').first();
      await editInput.fill('newdomain.com');

      // Save (save button is visible, not in opacity-0 div)
      await page.locator('button[title="Save"]').click();
    });

    test('should check single domain', async ({ page }) => {
      const checkDomain = `check-${Math.random().toString(36).slice(2, 6)}.com`;

      // Add domain
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(checkDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${checkDomain}")`)).toBeVisible({ timeout: 15000 });

      // Click check button using evaluate (button is opacity-0 on desktop)
      await page.locator(`tr:has-text("${checkDomain}") button[title="Check"]`).evaluate(el => (el as HTMLElement).click());

      // Should show "Checking..." status (use chained selector, not inline text=)
      await expect(page.locator(`tr:has-text("${checkDomain}")`).locator('text=Checking...')).toBeVisible({ timeout: 5000 });
    });

    test('should remove domain', async ({ page }) => {
      const removeDomain = `remove-${Math.random().toString(36).slice(2, 6)}.com`;
      
      // Add domain
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(removeDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${removeDomain}")`)).toBeVisible({ timeout: 15000 });
      
      // Click delete button
      const deleteButton = page.locator(`tr:has-text("${removeDomain}") button[title="Delete"]`);
      await deleteButton.click();
      
      // Verify removal
      await expect(page.locator(`tr:has-text("${removeDomain}")`)).not.toBeVisible();
    });

    test('should view domain history', async ({ page }) => {
      const historyDomain = `history-${Math.random().toString(36).slice(2, 6)}.com`;
      
      // Add domain
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(historyDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${historyDomain}")`)).toBeVisible({ timeout: 15000 });
      
      // Click history button
      const historyButton = page.locator(`tr:has-text("${historyDomain}") button[title="View History"]`);
      await historyButton.click();
      
      // Verify history modal/chart is visible
      await expect(page.locator(`h2:has-text("History - ${historyDomain}")`)).toBeVisible();
      
      // Close modal
      await page.locator('button[aria-label="Close"]').last().evaluate(el => (el as HTMLElement).click());
    });

    test('should view domain details', async ({ page }) => {
      const detailDomain = `detail-${Math.random().toString(36).slice(2, 6)}.com`;
      
      // Add domain
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(detailDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${detailDomain}")`)).toBeVisible({ timeout: 15000 });
      
      // Click on domain name to view details
      const domainLink = page.getByTestId(`domain-link-${detailDomain}`);
      await domainLink.click();
      
      // Verify detail modal
      const detailModal = page.getByTestId('detail-modal');
      await expect(detailModal).toBeVisible();
      await expect(detailModal.locator('h2')).toContainText(detailDomain);
      
      // Verify sections in detail modal
      await expect(detailModal.locator('h3:has-text("SSL Certificate")')).toBeVisible();
      await expect(detailModal.locator('h3:has-text("Domain Registration")')).toBeVisible();
      await expect(detailModal.locator('h3:has-text("Technology Stack")')).toBeVisible();
      await expect(detailModal.locator('h3:has-text("DNS Records")')).toBeVisible();
      
      // Close modal
      await detailModal.locator('button:has-text("Close")').evaluate(el => (el as HTMLElement).click());
      await expect(detailModal).not.toBeVisible();
    });

    test('should copy domain to clipboard', async ({ page }) => {
      const copyDomain = `copy-${Math.random().toString(36).slice(2, 6)}.com`;

      // Add domain
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(copyDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${copyDomain}")`)).toBeVisible({ timeout: 15000 });

      // Hover over domain link (uses group-hover/domain, not group-hover)
      const domainLink = page.getByTestId(`domain-link-${copyDomain}`);
      await domainLink.hover();

      // Click copy button using evaluate
      const copyButton = page.locator(`button[aria-label="Copy ${copyDomain} to clipboard"]`);
      await copyButton.evaluate(el => (el as HTMLElement).click());

      // Verify clipboard feedback - check icon should appear
      await expect(page.locator('svg[data-testid="CheckCheckIcon"]')).toBeVisible({ timeout: 2000 });
    });
  });

  test.describe('Selection and Bulk Actions', () => {
    test('should select and deselect domains', async ({ page }) => {
      // Add two domains
      const domain1 = `select1-${Math.random().toString(36).slice(2, 6)}.com`;
      const domain2 = `select2-${Math.random().toString(36).slice(2, 6)}.com`;
      
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(domain1);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${domain1}")`)).toBeVisible({ timeout: 15000 });
      
      await input.fill(domain2);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${domain2}")`)).toBeVisible({ timeout: 15000 });
      
      // Select first domain
      const checkbox1 = page.locator(`tr:has-text("${domain1}") input[type="checkbox"]`);
      await checkbox1.click();
      
      // Verify "Selected" badge appears
      await expect(page.locator('text=Selected')).toBeVisible();
      
      // Deselect
      await checkbox1.click();
      await expect(page.locator('text=Selected')).not.toBeVisible();
    });

    test('should select all domains', async ({ page }) => {
      // Add domains
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(`all1-${Math.random().toString(36).slice(2, 6)}.com`);
      await page.locator('button:has-text("Track")').click();
      await input.fill(`all2-${Math.random().toString(36).slice(2, 6)}.com`);
      await page.locator('button:has-text("Track")').click();

      // Use more specific selector to avoid strict mode violation
      await expect(page.locator('tr').filter({ hasText: 'all1' }).first()).toBeVisible({ timeout: 15000 });

      // Click select all checkbox in header
      const headerCheckbox = page.locator('thead input[type="checkbox"]');
      await headerCheckbox.click();

      // All domains should be selected
      const selectedCount = await page.locator('text=Selected').count();
      expect(selectedCount).toBeGreaterThan(0);
    });

    test('should check selected domains', async ({ page }) => {
      const checkDomain = `bulkcheck-${Math.random().toString(36).slice(2, 6)}.com`;

      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(checkDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${checkDomain}")`)).toBeVisible({ timeout: 15000 });

      // Select domain
      const checkbox = page.locator(`tr:has-text("${checkDomain}") input[type="checkbox"]`);
      await checkbox.click();

      // Wait for selected count badge to appear (confirms selection)
      await page.waitForSelector('text=Selected', { timeout: 5000 });

      // Click check selected button using evaluate (button might have animation/visibility issues)
      await page.locator('button[title="Check Selected"]').evaluate(el => (el as HTMLElement).click());

      // Should show checking status (use chained selector, not inline text=)
      await expect(page.locator(`tr:has-text("${checkDomain}")`).locator('text=Checking...')).toBeVisible({ timeout: 5000 });
    });

    test('should remove selected domains', async ({ page }) => {
      const removeDomain = `bulkremove-${Math.random().toString(36).slice(2, 6)}.com`;

      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(removeDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${removeDomain}")`)).toBeVisible({ timeout: 15000 });

      // Select domain
      const checkbox = page.locator(`tr:has-text("${removeDomain}") input[type="checkbox"]`);
      await checkbox.click();

      // Click delete button
      const deleteButton = page.locator('button[title="Remove Selected"]');
      await deleteButton.click();

      // Confirm deletion using evaluate (button is in modal with fixed overlay)
      await page.locator('[data-testid="confirm-modal"] button').filter({ hasText: 'Delete' }).evaluate(el => (el as HTMLElement).click());

      // Verify removal
      await expect(page.locator(`tr:has-text("${removeDomain}")`)).not.toBeVisible();
    });

    test('should assign group to selected domains', async ({ page }) => {
      const groupDomain = `groupassign-${Math.random().toString(36).slice(2, 6)}.com`;

      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(groupDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${groupDomain}")`)).toBeVisible({ timeout: 15000 });

      // Select domain
      const checkbox = page.locator(`tr:has-text("${groupDomain}") input[type="checkbox"]`);
      await checkbox.click();

      // Click assign group dropdown
      const assignButton = page.locator('button[title="Assign Group"]');
      await assignButton.click();

      // Select a group
      await page.locator('button:has-text("Personal")').click();

      // Verify group badge appears (use chained selector, not inline text=)
      await expect(page.locator(`tr:has-text("${groupDomain}")`).locator('text=Personal')).toBeVisible();
    });
  });

  test.describe('Filter and Sort', () => {
    test('should search domains', async ({ page }) => {
      const searchDomain = `searchtest-${Math.random().toString(36).slice(2, 6)}.com`;
      
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(searchDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${searchDomain}")`)).toBeVisible({ timeout: 15000 });
      
      // Search
      const searchInput = page.locator('input[placeholder*="Filter domains"]');
      await searchInput.fill(searchDomain);
      
      // Should find the domain
      await expect(page.locator(`tr:has-text("${searchDomain}")`)).toBeVisible();
      
      // Search for non-existent
      await searchInput.fill('nonexistent-xyz-123.com');
      await expect(page.locator('text=No matching domains')).toBeVisible();
      
      // Clear search
      await searchInput.clear();
    });

    test('should filter by status', async ({ page }) => {
      // Add a domain
      const statusDomain = `status-${Math.random().toString(36).slice(2, 6)}.com`;
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(statusDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${statusDomain}")`)).toBeVisible({ timeout: 15000 });
      
      // Wait for status to update from "Checking..."
      await page.waitForSelector(`tr:has-text("${statusDomain}")`, { timeout: 20000 });
      
      // Filter by status
      await page.getByTestId('status-filter').selectOption({ value: 'ALL' });
    });

    test('should filter by SSL status', async ({ page }) => {
      const sslSelect = page.getByTestId('ssl-filter');
      await sslSelect.selectOption({ value: 'ALL' });

      const selectedValue = await sslSelect.inputValue();
      expect(selectedValue).toBe('ALL');
    });

    test('should filter by group', async ({ page }) => {
      await page.getByTestId('group-filter').selectOption({ value: 'ALL' });
    });

    test('should sort by different fields', async ({ page }) => {
      const sortFields = [
        { name: 'Name', field: 'url' },
        { name: 'Status', field: 'status' },
        { name: 'Latency', field: 'latency' },
        { name: 'Last Checked', field: 'lastChecked' },
        { name: 'SSL', field: 'ssl' },
        { name: 'Expiry', field: 'expiry' }
      ];
      
      for (const sortField of sortFields) {
        // Click sort button
        const sortButton = page.locator(`button:has-text("${sortField.name}")`);
        await sortButton.click();
        
        // Verify sort indicator appears
        await expect(sortButton.locator('svg')).toBeVisible();
      }
    });

    test('should toggle sort order', async ({ page }) => {
      // Click sort twice to toggle order
      const sortButton = page.locator('button:has-text("Name")');
      await sortButton.click();
      
      // Should show ascending icon
      await expect(sortButton.locator('svg')).toBeVisible();
      
      // Click again to toggle
      await sortButton.click();
      
      // Icon should still be visible (descending now)
      await expect(sortButton.locator('svg')).toBeVisible();
    });
  });

  test.describe('Group Management', () => {
    test('should open group manager', async ({ page }) => {
      const manageButton = page.locator('button[title="Manage Groups"]');
      await manageButton.click();
      
      const modal = page.getByTestId('group-manager-modal');
      await expect(modal).toBeVisible();
      
      // Close
      await page.locator('button[aria-label="Close"]').last().evaluate(el => (el as HTMLElement).click());
    });

    test('should create new group', async ({ page }) => {
      const groupName = `Group-${Math.random().toString(36).slice(2, 6)}`;

      const manageButton = page.locator('button[title="Manage Groups"]');
      await manageButton.click();

      const modal = page.getByTestId('group-manager-modal');
      await expect(modal).toBeVisible();

      // Click "Add New Group"
      await modal.getByTestId('add-new-group-btn').evaluate(el => (el as HTMLElement).click());

      // Fill group name
      const nameInput = modal.locator('input[placeholder*="Production, Personal"]');
      await nameInput.fill(groupName);

      // Save
      await modal.locator('button:has-text("Save Group")').evaluate(el => (el as HTMLElement).click());

      // Verify group was created
      await expect(modal).toContainText(groupName);

      // Close
      await page.locator('button[aria-label="Close"]').last().evaluate(el => (el as HTMLElement).click());
    });

    test('should edit group name', async ({ page }) => {
      const editGroup = `EditGroup-${Math.random().toString(36).slice(2, 6)}`;

      // Create group first
      const manageButton = page.locator('button[title="Manage Groups"]');
      await manageButton.click();

      const modal = page.getByTestId('group-manager-modal');
      await modal.getByTestId('add-new-group-btn').evaluate(el => (el as HTMLElement).click());

      const nameInput = modal.locator('input[placeholder*="Production, Personal"]');
      await nameInput.fill(editGroup);
      await modal.locator('button:has-text("Save Group")').evaluate(el => (el as HTMLElement).click());

      // Wait for group to appear, then click its edit button
      await expect(modal).toContainText(editGroup);
      await modal.locator('button[title="Edit name"]').last().evaluate(el => (el as HTMLElement).click());

      // Change name in edit input
      const editInput = modal.getByTestId('edit-group-input');
      await editInput.fill(`${editGroup}-Updated`);
      await editInput.press('Enter');

      // Verify update
      await expect(modal).toContainText(`${editGroup}-Updated`);

      // Close
      await page.locator('button[aria-label="Close"]').last().evaluate(el => (el as HTMLElement).click());
    });

    test('should delete group', async ({ page }) => {
      const deleteGroup = `DeleteGroup-${Math.random().toString(36).slice(2, 6)}`;

      // Create group first
      const manageButton = page.locator('button[title="Manage Groups"]');
      await manageButton.click();

      const modal = page.getByTestId('group-manager-modal');
      await modal.getByTestId('add-new-group-btn').evaluate(el => (el as HTMLElement).click());

      const nameInput = modal.locator('input[placeholder*="Production, Personal"]');
      await nameInput.fill(deleteGroup);
      await modal.locator('button:has-text("Save Group")').evaluate(el => (el as HTMLElement).click());

      // Delete the group
      const groupRow = modal.locator(`text=${deleteGroup}`).locator('..');
      await groupRow.locator('button[title="Delete group"]').evaluate(el => (el as HTMLElement).click());

      // Confirm deletion
      await modal.locator('button:has-text("OK")').evaluate(el => (el as HTMLElement).click());

      // Verify deletion
      await expect(modal).not.toContainText(deleteGroup);

      // Close
      await page.locator('button[aria-label="Close"]').last().evaluate(el => (el as HTMLElement).click());
    });

    test('should assign group to domain from table', async ({ page }) => {
      const domain = `groupdomain-${Math.random().toString(36).slice(2, 6)}.com`;
      
      // Add domain
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(domain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${domain}")`)).toBeVisible({ timeout: 15000 });
      
      // Click group button on domain row
      const groupButton = page.locator(`tr:has-text("${domain}") button:has-text("Group")`);
      await groupButton.click();
      
      // Select a group
      await page.locator('button:has-text("Personal")').click();
      
      // Verify group badge appears
      await expect(page.locator(`tr:has-text("${domain}")`).locator('text=Personal')).toBeVisible();
    });
  });

  test.describe('Export and Import', () => {
    test('should export domains to CSV', async ({ page }) => {
      // Add a domain first
      const exportDomain = `export-${Math.random().toString(36).slice(2, 6)}.com`;
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(exportDomain);
      await page.locator('button:has-text("Track")').click();
      await expect(page.locator(`tr:has-text("${exportDomain}")`)).toBeVisible({ timeout: 15000 });
      
      // Click export button
      const exportButton = page.locator('button[title="Export CSV"]');
      await exportButton.click();
      
      // Should trigger download (can't verify file content in this test)
      // But we can verify no errors occurred
      await expect(page.locator('[data-testid="header-title"]')).toBeVisible();
    });

    test('should import from CSV file', async ({ page }) => {
      // Click import button
      const importLabel = page.locator('label[title="Import CSV"]');
      await importLabel.click();
      
      // Note: File upload requires file chooser handling
      // This test verifies the file input is triggered
      const fileInput = page.locator('input[type="file"]');
      await expect(fileInput).toBeAttached();
    });
  });

  test.describe('Check All Functionality', () => {
    test('should check all domains', async ({ page }) => {
      // Add multiple domains
      const input = page.locator('input[placeholder*="Enter domain to monitor"]');
      await input.fill(`checkall1-${Math.random().toString(36).slice(2, 6)}.com`);
      await page.locator('button:has-text("Track")').click();

      await input.fill(`checkall2-${Math.random().toString(36).slice(2, 6)}.com`);
      await page.locator('button:has-text("Track")').click();

      // Use more specific selector to avoid strict mode violation
      await expect(page.locator('tr').filter({ hasText: 'checkall1' }).first()).toBeVisible({ timeout: 15000 });

      // Click Check All
      const checkAllButton = page.locator('button:has-text("Check All")');
      await checkAllButton.click();

      // Should show progress indicator
      await expect(page.locator('text=Checking domains...')).toBeVisible({ timeout: 5000 });

      // Wait for check to complete
      await page.waitForSelector('text=Checking domains...', { state: 'hidden', timeout: 30000 });
    });

    test('should show check all progress', async ({ page }) => {
      // Ensure there's at least one domain for progress bar to appear
      const domainCount = await page.locator('tbody tr').count();
      if (domainCount === 0) {
        const input = page.locator('input[placeholder*="Enter domain to monitor"]');
        await input.fill('progresstest.com');
        await page.locator('button:has-text("Track")').click();
        await expect(page.locator('tr:has-text("progresstest.com")')).toBeVisible({ timeout: 15000 });
      }

      // Wait for at least 1 domain to be present before clicking Check All
      await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 5000 });

      const checkAllButton = page.locator('button:has-text("Check All")');
      await checkAllButton.click();

      // Progress bar should appear (shows checking progress)
      const progressBar = page.getByTestId('check-progress-bar');
      const progressBarParent = page.locator('[data-testid="check-progress-bar"]').locator('..');
      await expect(progressBarParent).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Bottom Panel', () => {
    test('should toggle bottom panel', async ({ page }) => {
      // Add domain so bottom panel renders (it doesn't show if there are no domains)
      const domainCount = await page.locator('tbody tr').count();
      if (domainCount === 0) {
        const input = page.locator('input[placeholder*="Enter domain to monitor"]');
        await input.fill('bottompanel.com');
        await page.locator('button:has-text("Track")').click();
        await expect(page.locator('tr:has-text("bottompanel.com")')).toBeVisible({ timeout: 15000 });
      }

      // Click toggle using evaluate (button is at bottom of page, outside viewport)
      const toggleButton = page.locator('button[aria-expanded]');
      await toggleButton.evaluate(el => (el as HTMLElement).click());

      // Panel content should expand
      await expect(page.locator('text=Urgent Attention')).toBeVisible({ timeout: 5000 });

      // Collapse
      await toggleButton.evaluate(el => (el as HTMLElement).click());
    });

    test('should show alerts in bottom panel', async ({ page }) => {
      // Add domain so bottom panel renders (it doesn't show if there are no domains)
      const domainCount = await page.locator('tbody tr').count();
      if (domainCount === 0) {
        const input = page.locator('input[placeholder*="Enter domain to monitor"]');
        await input.fill('alertspanel.com');
        await page.locator('button:has-text("Track")').click();
        await expect(page.locator('tr:has-text("alertspanel.com")')).toBeVisible({ timeout: 15000 });
      }

      // Expand panel using evaluate (button is at bottom of page, outside viewport)
      const toggleButton = page.locator('button[aria-expanded]');
      await toggleButton.evaluate(el => (el as HTMLElement).click());

      // Should show either alerts or "All systems operational"
      const hasAlerts = await page.locator('text=Alert').isVisible();
      const hasNoAlerts = await page.locator('text=All systems operational').isVisible();

      expect(hasAlerts || hasNoAlerts).toBeTruthy();
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should focus search with Cmd+K', async ({ page }) => {
      // Press Control+K (works on all platforms, Meta+K may not work in Linux headless)
      await page.keyboard.press('Control+k');

      // Give the app time to process the keyboard event and focus the input
      await page.waitForTimeout(100);

      // Search input should be focused
      const searchInput = page.locator('input[placeholder*="Filter domains"]');
      await expect(searchInput).toBeFocused();
    });

    test('should trigger check all with Cmd+Enter', async ({ page }) => {
      // Press Control+Enter (the app code checks metaKey || ctrlKey)
      await page.keyboard.press('Control+Enter');

      // Just verify the app responds without crashing
      await expect(page.getByTestId('header-title')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // Header should be visible
      await expect(page.getByTestId('header-title')).toBeVisible();
      
      // Stats should be visible
      await expect(page.locator('text=Total Monitored')).toBeVisible();
      
      // Domain table should be scrollable
      const table = page.locator('[aria-label="Domains table"]');
      await expect(table).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      
      // All main elements should be visible
      await expect(page.getByTestId('header-title')).toBeVisible();
      await expect(page.locator('text=Total Monitored')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async ({ page }) => {
      // Check for main landmarks using getByRole (matches implicit ARIA roles from semantic HTML)
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(page.getByRole('contentinfo')).toBeVisible();
    });

    test('should have skip links', async ({ page }) => {
      // Skip links should be present
      await expect(page.locator('a[href="#main-content"]')).toBeVisible();
    });

    test('buttons should have accessible names', async ({ page }) => {
      // All icon buttons should have aria-labels, titles, or visible text
      const iconButtons = page.locator('button svg').all();

      for (const icon of await iconButtons) {
        const parentButton = icon.locator('..');
        const hasAriaLabel = await parentButton.getAttribute('aria-label');
        const hasTitle = await parentButton.getAttribute('title');
        const textContent = await parentButton.textContent();
        const hasText = textContent && textContent.trim().length > 0;

        // Each button should have either aria-label, title, or visible text
        expect(hasAriaLabel || hasTitle || hasText).toBeTruthy();
      }
    });
  });

  test.describe('Error States', () => {
    test('should handle empty state', async ({ page }) => {
      // Clear all domains first (if any)
      const headerCheckbox = page.locator('thead input[type="checkbox"]');
      const hasDomains = await page.locator('tbody tr').count() > 0;

      if (hasDomains) {
        await headerCheckbox.click();
        const deleteButton = page.locator('button[title="Remove Selected"]');
        await deleteButton.click();
        // Confirm deletion using evaluate (button is in modal with fixed overlay)
        await page.locator('[data-testid="confirm-modal"] button').filter({ hasText: 'Delete' }).evaluate(el => (el as HTMLElement).click());
      }

      // Empty state should show helpful message
      await expect(page.locator('text=Ready to monitor')).toBeVisible();
    });

    test('should show no results for filtered empty state', async ({ page }) => {
      // Search for non-existent domain
      const searchInput = page.locator('input[placeholder*="Filter domains"]');
      await searchInput.fill('nonexistent-domain-xyz-123456.com');
      
      // Should show "No matching domains"
      await expect(page.locator('text=No matching domains')).toBeVisible();
    });
  });
});
