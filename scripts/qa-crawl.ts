/**
 * QA crawl CLI entry point (run via tsx).
 *
 * Usage:
 *   tsx scripts/qa-crawl.ts --url https://example.com
 *   tsx scripts/qa-crawl.ts --config sites.json
 *
 * Launches chromium per site, runs call-button + form checks, assembles
 * results, writes data/qa-results.json, prints a per-site summary, and exits
 * non-zero if any site has a FAIL.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { logger } from '../utils/logger';
import { CallCheckStatus, FormCheckStatus, type QaSiteConfig } from '../types';
import { checkCallButtons } from '../qa/callButtonService';
import { crawlAndCheckForms } from '../qa/formCheckService';
import { selectVerifier } from '../qa/delivery';
import { generateSiteReport } from '../qa/report';

/** Filesystem-safe slug for a site's report folder. */
function siteSlug(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'site';
}

interface SiteReport {
  url: string;
  formStatus: FormCheckStatus;
  callStatus: CallCheckStatus;
  forms: Awaited<ReturnType<typeof crawlAndCheckForms>>;
  calls: Awaited<ReturnType<typeof checkCallButtons>>;
}

function parseArgs(argv: string[]): { url?: string; config?: string } {
  const out: { url?: string; config?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url') out.url = argv[++i];
    else if (argv[i] === '--config') out.config = argv[++i];
  }
  return out;
}

async function loadSites(args: { url?: string; config?: string }): Promise<QaSiteConfig[]> {
  if (args.config) {
    const raw = await readFile(resolve(args.config), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  if (args.url) return [{ url: args.url }];
  throw new Error('Provide --url <url> or --config <file.json>');
}

/** Roll up per-form results into a single site-level status. */
function rollupForm(forms: SiteReport['forms']): FormCheckStatus {
  if (forms.some((f) => f.status === FormCheckStatus.Fail)) return FormCheckStatus.Fail;
  if (forms.some((f) => f.status === FormCheckStatus.Error)) return FormCheckStatus.Error;
  if (forms.some((f) => f.status === FormCheckStatus.Pass)) return FormCheckStatus.Pass;
  if (forms.every((f) => f.status === FormCheckStatus.NoForms)) return FormCheckStatus.NoForms;
  return FormCheckStatus.Unknown;
}

/** Roll up per-button results into a single site-level status. */
function rollupCall(calls: SiteReport['calls']): CallCheckStatus {
  if (calls.some((c) => c.status === CallCheckStatus.Fail)) return CallCheckStatus.Fail;
  if (calls.some((c) => c.status === CallCheckStatus.Error)) return CallCheckStatus.Error;
  if (calls.some((c) => c.status === CallCheckStatus.NotSwapped)) return CallCheckStatus.NotSwapped;
  if (calls.some((c) => c.status === CallCheckStatus.Pass)) return CallCheckStatus.Pass;
  if (calls.every((c) => c.status === CallCheckStatus.NoButtons)) return CallCheckStatus.NoButtons;
  return CallCheckStatus.Unknown;
}

async function runSite(site: QaSiteConfig, runDir?: string): Promise<SiteReport> {
  const browser = await chromium.launch();
  try {
    // Respect an explicit scheme (http/https/file…); only assume https for bare domains.
    const baseUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(site.url) ? site.url : `https://${site.url}`;
    const formEnabled = site.qa?.form?.enabled !== false;
    const callEnabled = site.qa?.call?.enabled !== false;

    let forms: SiteReport['forms'] = [];
    if (formEnabled) {
      forms = await crawlAndCheckForms(baseUrl, {
        browser,
        maxPages: site.qa?.crawl?.maxPages,
        markerPrefix: site.qa?.form?.marker,
        testData: site.qa?.form?.testData,
        screenshotDir: runDir,
      });
      // Run the configured delivery verifier (default: screen-only).
      const verifier = selectVerifier(site.qa?.form?.delivery ?? { type: 'screen-only' });
      for (const f of forms) {
        if (f.status === FormCheckStatus.Pass || f.status === FormCheckStatus.Fail) {
          f.delivery = await verifier.verifyDelivery(f, site.qa?.form?.delivery);
        }
      }
    }

    let calls: SiteReport['calls'] = [];
    if (callEnabled) {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        calls = await checkCallButtons(page);
      } catch (err) {
        calls = [
          {
            pageUrl: baseUrl,
            selector: '*',
            swapScriptPresent: false,
            numberSwapped: false,
            status: CallCheckStatus.Error,
            notes: `Navigation failed: ${(err as Error).message}`,
          },
        ];
      } finally {
        await context.close();
      }
    }

    return {
      url: site.url,
      formStatus: rollupForm(forms),
      callStatus: rollupCall(calls),
      forms,
      calls,
    };
  } finally {
    await browser.close();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const sites = await loadSites(args);
  const reports: SiteReport[] = [];

  const day = new Date().toISOString().slice(0, 10);
  for (const site of sites) {
    logger.info(`[qa-crawl] checking ${site.url}`);
    const runDir = resolve('reports', `${day}_${siteSlug(site.url)}`);
    await mkdir(runDir, { recursive: true });
    try {
      const report = await runSite(site, runDir);
      reports.push(report);
      const reportPath = await generateSiteReport(
        { ...report, generatedAt: new Date().toISOString() },
        runDir
      );
      logger.info(`[qa-crawl] report: ${reportPath}`);
    } catch (err) {
      logger.error(`[qa-crawl] ${site.url} failed`, err);
      reports.push({
        url: site.url,
        formStatus: FormCheckStatus.Error,
        callStatus: CallCheckStatus.Error,
        forms: [],
        calls: [],
      });
    }
  }

  const payload = JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2);
  const outPath = resolve('data/qa-results.json');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, payload);

  // Also publish to public/ so the dashboard can fetch /qa-results.json at runtime
  // (the QA engine is CLI-only; the SPA just reads the latest snapshot).
  const publicPath = resolve('public/qa-results.json');
  await mkdir(dirname(publicPath), { recursive: true });
  await writeFile(publicPath, payload);

  let anyFail = false;
  for (const r of reports) {
    const failed = r.formStatus === FormCheckStatus.Fail || r.callStatus === CallCheckStatus.Fail;
    if (failed) anyFail = true;
    logger.info(
      `[qa-crawl] ${r.url} — forms=${r.formStatus} (${r.forms.length}) calls=${r.callStatus} (${r.calls.length})${failed ? ' ❌ FAIL' : ''}`
    );
  }
  logger.info(`[qa-crawl] results written to ${outPath}`);

  if (anyFail) {
    // TODO: wire QA failures into notificationService (Slack/Discord/email).
    // The existing notificationService is browser-oriented (Notification API,
    // localStorage settings); a Node-side alert channel should be added before
    // enabling this in CI. Leaving an explicit hook here.
    logger.warn('[qa-crawl] one or more sites FAILED — TODO: dispatch alerts via notificationService');
    process.exitCode = 1;
  }
}

main().catch((err) => {
  logger.error('[qa-crawl] fatal error', err);
  process.exitCode = 1;
});
