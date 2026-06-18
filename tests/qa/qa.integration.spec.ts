import { test, expect } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { checkCallButtons } from '../../qa/callButtonService';
import { crawlAndCheckForms } from '../../qa/formCheckService';
import { CallCheckStatus, FormCheckStatus } from '../../types';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
let server: Server;
let baseUrl: string;
let browser: Browser;

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.xml': 'application/xml',
};

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/' || pathname.endsWith('/')) pathname += 'index.html';
      // Prevent path traversal.
      const filePath = normalize(join(FIXTURES, pathname));
      if (!filePath.startsWith(FIXTURES)) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, { 'content-type': MIME[extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  baseUrl = `http://localhost:${port}`;
  browser = await chromium.launch();
});

test.afterAll(async () => {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
});

// --- Form checks ----------------------------------------------------------

test('standard contact form is filled, submitted, success detected', async () => {
  const results = await crawlAndCheckForms(`${baseUrl}/contact-form.html`, { browser, maxPages: 1 });
  const r = results.find((x) => x.formId === 'contact');
  expect(r, 'contact form result').toBeTruthy();
  expect(r!.submitted).toBe(true);
  expect(r!.fieldsFilled).toBeGreaterThanOrEqual(2);
  expect(r!.onScreenSuccess).toBe(true);
  expect(r!.status).toBe(FormCheckStatus.Pass);
});

test('multi-field form maps name/email/phone/message', async () => {
  const results = await crawlAndCheckForms(`${baseUrl}/multi-field-form.html`, { browser, maxPages: 1 });
  const r = results[0]!;
  expect(r.fieldsFilled).toBeGreaterThanOrEqual(3);
  expect(r.status).toBe(FormCheckStatus.Pass);
});

test('silent-fail form is NOT a false pass', async () => {
  const results = await crawlAndCheckForms(`${baseUrl}/silent-fail-form.html`, { browser, maxPages: 1 });
  const r = results[0]!;
  expect(r.submitted).toBe(true);
  expect(r.onScreenSuccess).toBe(false);
  expect(r.status).toBe(FormCheckStatus.Fail);
});

test('recaptcha form is reported as untestable, not a pass', async () => {
  const results = await crawlAndCheckForms(`${baseUrl}/recaptcha-form.html`, { browser, maxPages: 1 });
  const r = results[0]!;
  expect(r.status).toBe(FormCheckStatus.Unknown);
  expect(r.onScreenSuccess).toBe(false);
  expect(r.notes).toMatch(/captcha/i);
});

test('page with no forms reports NoForms', async () => {
  const results = await crawlAndCheckForms(`${baseUrl}/no-forms.html`, { browser, maxPages: 1 });
  expect(results[0]!.status).toBe(FormCheckStatus.NoForms);
});

test('crawler respects maxPages on a looping link graph', async () => {
  const results = await crawlAndCheckForms(`${baseUrl}/crawl/index.html`, { browser, maxPages: 3 });
  // No forms anywhere, so a single NoForms result is produced after visiting <= maxPages.
  expect(results.length).toBeGreaterThanOrEqual(1);
  // Distinct page URLs visited must not exceed maxPages (loop guard works).
  const pages = new Set(results.map((r) => r.pageUrl));
  expect(pages.size).toBeLessThanOrEqual(3);
});

// --- Call-button checks ----------------------------------------------------

async function checkCalls(path: string, swapWaitMs?: number) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${baseUrl}/${path}`, { waitUntil: 'domcontentloaded' });
  const results = await checkCallButtons(page, swapWaitMs ? { swapWaitMs } : {});
  await ctx.close();
  return results;
}

test('CallRail swap is detected as swapped', async () => {
  const results = await checkCalls('callrail-swap.html', 1500);
  expect(results[0]!.swapScriptPresent).toBe(true);
  expect(results[0]!.numberSwapped).toBe(true);
  expect(results[0]!.status).toBe(CallCheckStatus.Pass);
});

test('no-swap page reported NotSwapped', async () => {
  const results = await checkCalls('callrail-no-swap.html');
  expect(results[0]!.swapScriptPresent).toBe(false);
  expect(results[0]!.numberSwapped).toBe(false);
  expect(results[0]!.status).toBe(CallCheckStatus.NotSwapped);
});

test('slow swap (3s) is eventually detected', async () => {
  const results = await checkCalls('callrail-slow-swap.html', 5000);
  expect(results[0]!.numberSwapped).toBe(true);
  expect(results[0]!.status).toBe(CallCheckStatus.Pass);
});

test('mismatched multi-button page: swapped one passes, static one NotSwapped', async () => {
  const results = await checkCalls('callrail-mismatch.html', 1500);
  expect(results.length).toBe(2);
  const statuses = results.map((r) => r.status).sort();
  expect(statuses).toContain(CallCheckStatus.Pass);
  expect(statuses).toContain(CallCheckStatus.NotSwapped);
});

test('no call buttons reported NoButtons', async () => {
  const results = await checkCalls('no-forms.html');
  expect(results[0]!.status).toBe(CallCheckStatus.NoButtons);
});
