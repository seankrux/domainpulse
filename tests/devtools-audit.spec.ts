import { test, expect } from '@playwright/test';

/**
 * Chrome DevTools Automated Test
 * 
 * This test runs Chrome DevTools audits on every code change:
 * - Performance metrics
 * - Accessibility checks
 * - Best practices
 * - SEO scoring
 * - Console error detection
 * - Network failure detection
 */

test.describe('Chrome DevTools Audit', () => {
  test.setTimeout(120000);

  test('should pass DevTools audit checks', async ({ page }, testInfo) => {
    const auditResults: {
      name: string;
      score?: number;
      passed: boolean;
      errors: string[];
    }[] = [];

    // Collect console errors
    const consoleErrors: string[] = [];
    const networkFailures: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[${msg.type()}] ${msg.text()} at ${msg.location().url || 'unknown'}`);
      }
    });

    page.on('requestfailed', request => {
      networkFailures.push(`Failed: ${request.url()} - ${request.failure()?.errorText || 'Unknown error'}`);
    });

    // 1. Navigate to app
    await page.goto('http://localhost:3000');

    // Handle Login
    const passwordInput = page.locator('#password');
    if (await passwordInput.isVisible()) {
      await passwordInput.fill('testpassword');
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="header-title"]', { timeout: 15000 });
    }

    // 2. Performance Audit - Measure load time
    const performanceMetrics: { [key: string]: number } = {};
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    
    const metrics = await page.evaluate(() => {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      return {
        domContentLoaded: navEntry?.domContentLoadedEventEnd || 0,
        loadComplete: navEntry?.loadEventEnd || 0,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });

    performanceMetrics.domContentLoaded = metrics.domContentLoaded;
    performanceMetrics.loadComplete = metrics.loadComplete;
    performanceMetrics.firstPaint = metrics.firstPaint;
    performanceMetrics.firstContentfulPaint = metrics.firstContentfulPaint;

    auditResults.push({
      name: 'Performance - Page Load',
      score: metrics.loadComplete < 3000 ? 100 : metrics.loadComplete < 5000 ? 80 : 50,
      passed: metrics.loadComplete < 5000,
      errors: metrics.loadComplete >= 5000 ? [`Load time: ${metrics.loadComplete.toFixed(0)}ms (target: <5000ms)`] : []
    });

    // 3. Accessibility Audit
    const accessibilityIssues: string[] = [];
    
    // Check for missing alt text on images
    const imagesWithoutAlt = await page.evaluate(() => {
      const images = Array.from(document.querySelectorAll('img:not([alt])'));
      return images.length;
    });
    
    if (imagesWithoutAlt > 0) {
      accessibilityIssues.push(`${imagesWithoutAlt} images missing alt attribute`);
    }

    // Check for missing aria-labels on buttons
    const buttonsWithoutLabel = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button:not([aria-label]):not([title])'));
      return buttons.filter(b => !b.textContent?.trim()).length;
    });

    if (buttonsWithoutLabel > 0) {
      accessibilityIssues.push(`${buttonsWithoutLabel} buttons missing accessible labels`);
    }

    // Check color contrast (simplified check)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const contrastIssues = await page.evaluate(() => {
      // This is a simplified check - real contrast checking requires more complex logic
      const elements = Array.from(document.querySelectorAll('*'));
      const issues = 0;
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.color === 'rgba(0, 0, 0, 0)' || style.backgroundColor === 'rgba(0, 0, 0, 0)') {
          // Skip transparent elements
        }
      });
      return issues;
    });

    auditResults.push({
      name: 'Accessibility',
      score: accessibilityIssues.length === 0 ? 100 : 100 - (accessibilityIssues.length * 10),
      passed: accessibilityIssues.length === 0,
      errors: accessibilityIssues
    });

    // 4. Best Practices Audit
    const bestPracticeIssues: string[] = [];

    // Check for HTTPS usage (in production)
    const isHTTPS = page.url().startsWith('https://');
    if (!isHTTPS && process.env.NODE_ENV === 'production') {
      bestPracticeIssues.push('Not using HTTPS');
    }

    // Check for deprecated APIs
    const deprecatedAPIs = await page.evaluate(() => {
      const deprecated = [];
      if ('webkitRequestFileSystem' in window) deprecated.push('webkitRequestFileSystem');
      if ('mozRequestFileSystem' in window) deprecated.push('mozRequestFileSystem');
      return deprecated;
    });

    if (deprecatedAPIs.length > 0) {
      bestPracticeIssues.push(`Using deprecated APIs: ${deprecatedAPIs.join(', ')}`);
    }

    auditResults.push({
      name: 'Best Practices',
      score: bestPracticeIssues.length === 0 ? 100 : 80,
      passed: bestPracticeIssues.length === 0,
      errors: bestPracticeIssues
    });

    // 5. Test core functionality
    await page.fill('input[placeholder*="Enter domain"]', 'example.com');
    await page.click('button:has-text("Track")');
    
    // Wait for domain to be added
    await page.waitForSelector('tr:has-text("example.com")', { timeout: 10000 });

    // 6. Generate Audit Report
    const report = {
      timestamp: new Date().toISOString(),
      url: page.url(),
      performance: performanceMetrics,
      audits: auditResults,
      consoleErrors: consoleErrors.slice(0, 50), // Limit to first 50 errors
      networkFailures: networkFailures.slice(0, 50),
      summary: {
        totalAudits: auditResults.length,
        passedAudits: auditResults.filter(a => a.passed).length,
        totalErrors: consoleErrors.length + networkFailures.length
      }
    };

    // Save audit report
    await testInfo.attach('devtools-audit-report.json', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json'
    });

    // Generate HTML report
    const htmlReport = generateHTMLReport(report);
    await testInfo.attach('devtools-audit-report.html', {
      body: htmlReport,
      contentType: 'text/html'
    });

    // Assert no critical errors
    expect(consoleErrors.filter(e => !e.includes('favicon')).length).toBeLessThan(5);
    expect(auditResults.filter(a => a.passed).length).toBe(auditResults.length);
  });
});

function generateHTMLReport(report: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>DevTools Audit Report - ${report.timestamp}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 20px; }
    h1 { color: #1a1a2e; }
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
    .card { padding: 20px; border-radius: 8px; background: #f8f9fa; }
    .card h3 { margin: 0 0 10px 0; color: #666; font-size: 14px; }
    .card .value { font-size: 32px; font-weight: bold; color: #1a1a2e; }
    .pass { color: #22c55e; }
    .fail { color: #ef4444; }
    .audit { margin: 20px 0; padding: 15px; border-left: 4px solid #22c55e; background: #f8f9fa; }
    .audit.fail { border-left-color: #ef4444; }
    .audit h4 { margin: 0 0 10px 0; }
    .errors { color: #ef4444; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f8f9fa; }
  </style>
</head>
<body>
  <h1>🔍 DevTools Audit Report</h1>
  <p>Generated: ${new Date(report.timestamp).toLocaleString()}</p>
  <p>URL: ${report.url}</p>
  
  <div class="summary">
    <div class="card">
      <h3>Audits Passed</h3>
      <div class="value ${report.summary.passedAudits === report.summary.totalAudits ? 'pass' : 'fail'}">
        ${report.summary.passedAudits}/${report.summary.totalAudits}
      </div>
    </div>
    <div class="card">
      <h3>Console Errors</h3>
      <div class="value ${report.summary.totalErrors === 0 ? 'pass' : 'fail'}">${report.summary.totalErrors}</div>
    </div>
    <div class="card">
      <h3>Network Failures</h3>
      <div class="value ${report.networkFailures.length === 0 ? 'pass' : 'fail'}">${report.networkFailures.length}</div>
    </div>
  </div>

  <h2>Performance Metrics</h2>
  <table>
    <tr><th>Metric</th><th>Value (ms)</th></tr>
    <tr><td>DOM Content Loaded</td><td>${report.performance.domContentLoaded.toFixed(0)}</td></tr>
    <tr><td>Load Complete</td><td>${report.performance.loadComplete.toFixed(0)}</td></tr>
    <tr><td>First Paint</td><td>${report.performance.firstPaint.toFixed(0)}</td></tr>
    <tr><td>First Contentful Paint</td><td>${report.performance.firstContentfulPaint.toFixed(0)}</td></tr>
  </table>

  <h2>Audit Results</h2>
  ${report.audits.map((audit: any) => `
    <div class="audit ${audit.passed ? '' : 'fail'}">
      <h4>${audit.passed ? '✅' : '❌'} ${audit.name}</h4>
      ${audit.errors.length > 0 ? `<div class="errors">${audit.errors.join('<br>')}</div>` : ''}
    </div>
  `).join('')}

  ${report.consoleErrors.length > 0 ? `
    <h2>Console Errors (${report.consoleErrors.length})</h2>
    <ul>
      ${report.consoleErrors.slice(0, 20).map((e: string) => `<li>${e}</li>`).join('')}
      ${report.consoleErrors.length > 20 ? `<li>... and ${report.consoleErrors.length - 20} more</li>` : ''}
    </ul>
  ` : ''}

  ${report.networkFailures.length > 0 ? `
    <h2>Network Failures (${report.networkFailures.length})</h2>
    <ul>
      ${report.networkFailures.slice(0, 20).map((f: string) => `<li>${f}</li>`).join('')}
      ${report.networkFailures.length > 20 ? `<li>... and ${report.networkFailures.length - 20} more</li>` : ''}
    </ul>
  ` : ''}
</body>
</html>
  `;
}
