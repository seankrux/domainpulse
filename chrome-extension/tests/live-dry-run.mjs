/**
 * Live dry-run: load PulseSEO unpacked in Chromium and exercise UI flows.
 * Run: node chrome-extension/tests/live-dry-run.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(__dirname, '..');
const OUT = path.resolve(__dirname, '../../../tmp/pulse-seo-dry-run');
fs.mkdirSync(OUT, { recursive: true });

const findings = [];
function note(sev, msg) {
  findings.push({ sev, msg });
  console.log(`[${sev}] ${msg}`);
}

async function main() {
  const userData = path.join(OUT, 'profile');
  fs.rmSync(userData, { recursive: true, force: true });
  fs.mkdirSync(userData, { recursive: true });

  const context = await chromium.launchPersistentContext(userData, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${EXT}`,
      `--load-extension=${EXT}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-dev-shm-usage',
    ],
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 900 },
  });

  // Wait for service worker / extension id
  let extId = null;
  for (let i = 0; i < 40; i++) {
    const sw = context.serviceWorkers();
    const bg = context.backgroundPages?.() || [];
    const workers = [...sw];
    for (const w of workers) {
      const u = w.url();
      const m = u.match(/^chrome-extension:\/\/([a-p]{32})\//);
      if (m) {
        extId = m[1];
        break;
      }
    }
    if (extId) break;
    // Also probe via chrome://extensions is blocked; try opening options with unknown id later
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!extId) {
    // Fallback: read Preferences for extension id
    const prefPath = path.join(userData, 'Default', 'Preferences');
    for (let i = 0; i < 20 && !fs.existsSync(prefPath); i++) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (fs.existsSync(prefPath)) {
      const pref = JSON.parse(fs.readFileSync(prefPath, 'utf8'));
      const settings = pref?.extensions?.settings || {};
      for (const [id, meta] of Object.entries(settings)) {
        if (meta?.path === EXT || meta?.manifest?.name?.includes('PulseSEO')) {
          extId = id;
          break;
        }
      }
      if (!extId) {
        const ids = Object.keys(settings).filter((id) => settings[id]?.path?.includes('chrome-extension'));
        if (ids.length) extId = ids[0];
      }
    }
  }

  if (!extId) {
    // Last resort: list service workers again after navigating
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 1000));
    for (const w of context.serviceWorkers()) {
      const m = w.url().match(/^chrome-extension:\/\/([a-p]{32})\//);
      if (m) extId = m[1];
    }
  }

  if (!extId) {
    note('CRITICAL', 'Could not resolve extension ID after load');
    await context.close();
    process.exit(1);
  }
  note('OK', `Extension ID: ${extId}`);

  // Open a real page FIRST so GET_CONTEXT can see http(s)
  const site = await context.newPage();
  await site.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
  await site.waitForTimeout(400);

  // --- Options page ---
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extId}/options/index.html`, {
    waitUntil: 'domcontentloaded',
  });
  await options.waitForTimeout(800);
  await options.screenshot({ path: path.join(OUT, '01-options.png'), fullPage: true });

  const extIdShown = await options.locator('#extId').innerText();
  const redirect = await options.locator('#redirectUri').innerText();
  if (!extIdShown || extIdShown === 'loading…') {
    note('HIGH', 'Options page did not populate extension ID (GET_SETUP failed?)');
  } else {
    note('OK', `Options extId shown: ${extIdShown}`);
  }
  if (!redirect.includes('.chromiumapp.org/')) {
    note('HIGH', `Redirect URI missing/wrong: ${redirect}`);
  } else {
    note('OK', `Redirect URI: ${redirect}`);
  }

  // Save empty client id — should error
  await options.locator('#saveBtn').click();
  await options.waitForTimeout(400);
  const saveMsg = await options.locator('#savedMsg').innerText();
  if (!/required|must look like|Client ID/i.test(saveMsg)) {
    note('MEDIUM', `Empty Client ID save message unexpected: "${saveMsg}"`);
  } else {
    note('OK', `Empty Client ID rejected: ${saveMsg}`);
  }

  // Invalid client id
  await options.locator('#clientId').fill('not-valid');
  await options.locator('#saveBtn').click();
  await options.waitForTimeout(400);
  const badMsg = await options.locator('#savedMsg').innerText();
  if (!/must look like/i.test(badMsg)) {
    note('HIGH', `Invalid Client ID not validated: "${badMsg}"`);
  } else {
    note('OK', 'Invalid Client ID rejected');
  }

  // Valid-format client id (fake) — should save
  const fakeClient = '123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com';
  await options.locator('#clientId').fill(fakeClient);
  await options.locator('#saveBtn').click();
  await options.waitForTimeout(500);
  const okMsg = await options.locator('#savedMsg').innerText();
  if (!/Saved/i.test(okMsg)) {
    note('HIGH', `Valid Client ID did not save: "${okMsg}"`);
  } else {
    note('OK', 'Valid-format Client ID saved');
  }
  await options.screenshot({ path: path.join(OUT, '02-options-saved.png'), fullPage: true });

  // Bring example.com to front, then open side panel page
  await site.bringToFront();
  await site.waitForTimeout(300);

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extId}/sidepanel/index.html`, {
    waitUntil: 'domcontentloaded',
  });
  await panel.waitForTimeout(1500);
  await panel.screenshot({ path: path.join(OUT, '03-sidepanel-auth.png'), fullPage: true });

  const authVisible = await panel.locator('#authGate').isVisible().catch(() => false);
  const signOutHidden = await panel.locator('#signOutBtn').evaluate((el) => el.hidden);
  const bodyClass = await panel.locator('body').getAttribute('class');
  note('OK', `Side panel body class: ${bodyClass}; authVisible: ${authVisible}; signOutHidden: ${signOutHidden}`);

  if (!authVisible) {
    note('HIGH', 'Auth gate not shown without Google session (expected Sign in gate)');
  } else {
    note('OK', 'Auth gate shown when unsigned-in');
  }
  if (!signOutHidden) {
    note('HIGH', 'Sign out visible while unsigned-in');
  } else {
    note('OK', 'Sign out hidden while unsigned-in');
  }

  const signIn = panel.locator('#signInBtn');
  if (!(await signIn.count())) note('CRITICAL', 'Sign in button missing');
  else note('OK', 'Sign in button present');

  await panel.locator('#settingsBtn').click();
  await panel.waitForTimeout(500);
  note('OK', `Pages after settings click: ${context.pages().length}`);

  // Refresh with example.com available via fallback getActiveTab
  await site.bringToFront();
  await site.waitForTimeout(200);
  await panel.bringToFront();
  await panel.locator('#refreshBtn').click();
  await panel.waitForTimeout(1200);
  await panel.screenshot({ path: path.join(OUT, '04-sidepanel-refresh.png'), fullPage: true });

  const pageUrlText = await panel.locator('#pageUrl').innerText();
  note('OK', `Context URL line: ${pageUrlText}`);
  if (pageUrlText.includes('example.com')) {
    note('OK', 'getActiveTab fell back to example.com http tab');
  } else if (/Open an http|chrome-extension/i.test(pageUrlText)) {
    note('HIGH', 'Context did not resolve example.com via http-tab fallback');
  }

  // Auth gate should still show (unsigned-in) even with pageUrl resolved
  const authAfter = await panel.locator('#authGate').isVisible().catch(() => false);
  if (!authAfter) note('HIGH', 'Auth gate missing after refresh with http page + no token');
  else note('OK', 'Auth gate still shown after http context + no token');

  const auditSrc = fs.readFileSync(path.join(EXT, 'content/page-audit.js'), 'utf8');
  const auditFromPage = await site.evaluate((src) => eval(src), auditSrc);
  if (!auditFromPage?.ok) {
    note('HIGH', `On-page audit IIFE failed on example.com: ${JSON.stringify(auditFromPage)}`);
  } else {
    note('OK', `On-page audit on example.com: title="${auditFromPage.title}", issues=${auditFromPage.issues.length}`);
    await fs.promises.writeFile(
      path.join(OUT, 'audit-example.json'),
      JSON.stringify(auditFromPage, null, 2)
    );
  }

  for (const t of ['analytics', 'inspect', 'monitor', 'actions', 'onpage', 'notes']) {
    const count = await panel.locator(`.tab[data-tab="${t}"]`).count();
    if (!count) note('HIGH', `Missing tab: ${t}`);
  }
  note('OK', 'All six tabs present in DOM');

  const tabsPointer = await panel.locator('.tabs').evaluate((el) => getComputedStyle(el).pointerEvents);
  const monitorVisible = await panel.locator('#panel-monitor').isVisible().catch(() => false);
  if (tabsPointer !== 'none') {
    note('HIGH', `Expected gated tabs pointer-events:none, got ${tabsPointer}`);
  } else {
    note('OK', 'Gated CSS blocks tab pointer events');
  }
  if (monitorVisible) note('HIGH', 'Monitor panel visible while auth-gated');
  else note('OK', 'Monitor panel hidden while auth-gated');

  const swCount = context.serviceWorkers().length;
  if (!swCount) note('HIGH', 'No extension service worker registered');
  else note('OK', `Service workers: ${swCount}`);

  for (const s of [16, 32, 48, 128]) {
    if (!fs.existsSync(path.join(EXT, `icons/icon${s}.png`))) {
      note('HIGH', `Missing icon${s}.png`);
    }
  }

  await site.bringToFront();
  await site.waitForTimeout(200);
  const ctx = await options.evaluate(async () => chrome.runtime.sendMessage({ type: 'GET_CONTEXT' }));
  note('OK', `GET_CONTEXT: ${JSON.stringify(ctx).slice(0, 320)}`);
  if (!ctx?.ok) note('HIGH', 'GET_CONTEXT message failed');
  else if (ctx.result?.needsAuth !== true) {
    note('HIGH', `Expected needsAuth=true, got: ${JSON.stringify(ctx.result)}`);
  } else if (ctx.result?.pageUrl !== 'https://example.com/') {
    note('MEDIUM', `pageUrl expected example.com, got ${ctx.result?.pageUrl}`);
  } else {
    note('OK', 'GET_CONTEXT: needsAuth + example.com pageUrl');
  }

  await panel.screenshot({ path: path.join(OUT, '05-final.png'), fullPage: true });

  const report = {
    extId,
    findings,
    high: findings.filter((f) => f.sev === 'HIGH' || f.sev === 'CRITICAL'),
    medium: findings.filter((f) => f.sev === 'MEDIUM'),
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(`CRITICAL/HIGH: ${report.high.length}`);
  console.log(`MEDIUM: ${report.medium.length}`);
  console.log(`Artifacts: ${OUT}`);

  await context.close();
  if (report.high.length) process.exit(2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
