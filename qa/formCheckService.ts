/**
 * Form crawl + submit QA engine.
 *
 * Runs server-side under Node via the `playwright` chromium API. It discovers
 * pages (sitemap.xml if present, else bounded BFS over internal links), finds
 * <form>s, maps fields heuristically, skips dangerous forms (login/payment/
 * search/captcha), fills + submits with a unique marker, and conservatively
 * detects on-screen success.
 *
 * Pure helpers (makeMarker, mapFields, detectSuccess, isSkippableForm) are
 * exported for unit testing without a browser.
 */
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import type { Browser, Page, Locator } from 'playwright';
import { FormCheckStatus, type FormResult } from '../types';

/**
 * Capture one screenshot proving the post-submit state. Prefers the form
 * element; if it's gone (success often replaces the form), falls back to the
 * viewport so the thank-you / error state is still visible. Returns the
 * relative path ("shots/<file>.png") or undefined on failure.
 */
async function captureFormShot(
  page: Page,
  form: Locator,
  screenshotDir: string,
  fileBase: string
): Promise<string | undefined> {
  try {
    await mkdir(join(screenshotDir, 'shots'), { recursive: true });
    const rel = `shots/${fileBase}.png`;
    const abs = join(screenshotDir, rel);
    if (await form.count().catch(() => 0)) {
      await form.first().screenshot({ path: abs, timeout: 5000 });
    } else {
      await page.screenshot({ path: abs, timeout: 5000 });
    }
    return rel;
  } catch {
    return undefined;
  }
}

/** Filesystem-safe slug from a page URL + form index. */
function shotName(pageUrl: string, fi: number): string {
  const slug = pageUrl.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';
  return `${slug}-form${fi}`;
}

export interface FormCheckOpts {
  browser: Browser;
  maxPages?: number;
  runId?: string;
  markerPrefix?: string;
  testData?: { name?: string; email?: string; phone?: string; message?: string };
  /** Hard cap on the number of URLs visited regardless of maxPages. */
  visitedCap?: number;
  /** If set, write one post-submit screenshot per form here and record its relative path. */
  screenshotDir?: string;
}

const DEFAULT_MAX_PAGES = 10;
const DEFAULT_VISITED_CAP = 100;

export type FieldRole = 'name' | 'email' | 'phone' | 'message';

/** A description of a single form field discovered on the page. */
export interface FieldDescriptor {
  /** input/textarea/select */
  tag: string;
  type?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  label?: string;
}

/** Signals collected from a form, used for skip detection (pure-testable). */
export interface FormSignals {
  hasPassword: boolean;
  hasCaptcha: boolean;
  actionOrId: string;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Build a unique marker token, e.g. `QA-TEST-clienta-run42-1718800000000`.
 * Deterministic given inputs except for the appended timestamp.
 */
export function makeMarker(prefix: string, site: string, runId: string): string {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  return [slug(prefix || 'QA-TEST'), slug(site), slug(runId), Date.now()].filter(Boolean).join('-');
}

/**
 * Heuristically classify a single field into a role, or null if unknown.
 * Considers type, name, id, placeholder and associated label text.
 */
export function classifyField(f: FieldDescriptor): FieldRole | null {
  const hay = [f.type, f.name, f.id, f.placeholder, f.label]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (f.type === 'email' || /email|e-mail/.test(hay)) return 'email';
  if (f.type === 'tel' || /phone|\btel\b|mobile|cell/.test(hay)) return 'phone';
  if (f.tag === 'textarea' || /message|comment|enquiry|inquiry|question|details/.test(hay))
    return 'message';
  if (/name/.test(hay)) return 'name';
  return null;
}

/**
 * Map a list of field descriptors to roles, first-match-wins per role.
 * Returns a record keyed by role with the matching descriptor.
 */
export function mapFields(fields: FieldDescriptor[]): Partial<Record<FieldRole, FieldDescriptor>> {
  const out: Partial<Record<FieldRole, FieldDescriptor>> = {};
  for (const f of fields) {
    const role = classifyField(f);
    if (role && !out[role]) out[role] = f;
  }
  return out;
}

/**
 * Decide whether a form should be skipped (login/payment/search/captcha).
 */
export function isSkippableForm(signals: FormSignals): { skip: boolean; reason?: string } {
  if (signals.hasPassword) return { skip: true, reason: 'password field present (login/signup)' };
  const a = signals.actionOrId.toLowerCase();
  if (/login|signin|sign-in|register|signup|sign-up|password/.test(a))
    return { skip: true, reason: 'login/registration form' };
  if (/payment|checkout|billing|card|stripe|paypal/.test(a))
    return { skip: true, reason: 'payment/checkout form' };
  if (/\bsearch\b|\/search|search-form/.test(a)) return { skip: true, reason: 'search form' };
  return { skip: false };
}

/**
 * Conservatively detect on-screen success from a set of signals.
 * Never reports success if a captcha is present.
 */
export function detectSuccess(signals: {
  html: string;
  urlChanged: boolean;
  formStillPresent: boolean;
  hasCaptcha: boolean;
}): boolean {
  if (signals.hasCaptcha) return false;
  const h = signals.html.toLowerCase();
  const successText =
    /thank you|thanks for|we'?ll be in touch|message (was )?sent|submission received|successfully (sent|submitted)|form submitted|we have received/.test(
      h
    );
  const successClass = /class="[^"]*\b(success|thank-you|form-success|wpforms-confirmation)\b/.test(
    h
  );
  if (successText || successClass) return true;
  // URL changed to a thank-you-ish destination is a strong signal.
  if (signals.urlChanged && /thank|success|confirm|submitted/.test(h)) return true;
  // Form disappeared after submit AND no captcha -> probable success.
  if (signals.urlChanged && !signals.formStillPresent) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Browser-driven crawl
// ---------------------------------------------------------------------------

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    return url.toString();
  } catch {
    return u;
  }
}

function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/** Try to fetch and parse sitemap.xml; returns [] if absent/unparseable. */
async function discoverFromSitemap(page: Page, baseUrl: string): Promise<string[]> {
  try {
    const origin = new URL(baseUrl).origin;
    const resp = await page.context().request.get(`${origin}/sitemap.xml`);
    if (!resp.ok()) return [];
    const xml = await resp.text();
    const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1]!);
    return locs.filter((l) => sameOrigin(l, baseUrl)).map(normalizeUrl);
  } catch {
    return [];
  }
}

/** Collect internal links on the current page. */
async function collectLinks(page: Page, baseUrl: string): Promise<string[]> {
  const hrefs = await page.$$eval('a[href]', (els) =>
    els.map((e) => (e as HTMLAnchorElement).href)
  );
  return hrefs
    .map(normalizeUrl)
    .filter((h) => sameOrigin(h, baseUrl) && /^https?:/.test(h));
}

/** Fill + submit forms on the current page, returning results. */
async function checkFormsOnPage(page: Page, marker: string, opts: FormCheckOpts): Promise<FormResult[]> {
  const pageUrl = page.url();
  const data = {
    name: opts.testData?.name ?? 'QA Test',
    email: opts.testData?.email ?? 'team@merlinomarketing.com',
    phone: opts.testData?.phone ?? '555-0100',
    message: opts.testData?.message ?? `Automated QA test ${marker}. Please ignore.`,
  };

  const formCount = await page.locator('form').count();
  const results: FormResult[] = [];

  for (let fi = 0; fi < formCount; fi++) {
    const form = page.locator('form').nth(fi);
    try {
    // Gather signals for skip detection.
    const signals = await form.evaluate((el: Element) => {
      const f = el as HTMLFormElement;
      const hasPassword = !!f.querySelector('input[type="password"]');
      const hasCaptcha =
        !!f.querySelector('.g-recaptcha, [data-sitekey], iframe[src*="recaptcha"], .h-captcha') ||
        !!document.querySelector('.g-recaptcha, iframe[src*="recaptcha"]');
      return {
        hasPassword,
        hasCaptcha,
        actionOrId: `${f.getAttribute('action') || ''} ${f.id || ''} ${f.className || ''} ${f.name || ''}`,
        formId: f.id || f.getAttribute('name') || `form-${Array.from(document.forms).indexOf(f)}`,
      };
    }, undefined, { timeout: 8000 });

    const skip = isSkippableForm({
      hasPassword: signals.hasPassword,
      hasCaptcha: signals.hasCaptcha,
      actionOrId: signals.actionOrId,
    });
    if (skip.skip) {
      results.push({
        pageUrl,
        formId: signals.formId,
        fieldsFilled: 0,
        submitted: false,
        onScreenSuccess: false,
        marker,
        status: FormCheckStatus.Unknown,
        notes: `Skipped: ${skip.reason}`,
      });
      continue;
    }

    if (signals.hasCaptcha) {
      results.push({
        pageUrl,
        formId: signals.formId,
        fieldsFilled: 0,
        submitted: false,
        onScreenSuccess: false,
        marker,
        status: FormCheckStatus.Unknown,
        notes: 'CAPTCHA/recaptcha present — form is untestable, not claiming success.',
      });
      continue;
    }

    // Describe fields, then map roles.
    const descriptors: FieldDescriptor[] = await form.evaluate((el: Element) => {
      const f = el as HTMLFormElement;
      const nodes = Array.from(f.querySelectorAll('input, textarea, select'));
      return nodes
        .filter((n) => {
          const t = (n as HTMLInputElement).type;
          return !['hidden', 'submit', 'button', 'password', 'file'].includes(t);
        })
        .map((n) => {
          const inp = n as HTMLInputElement;
          let label = '';
          if (inp.id) {
            const lbl = f.querySelector(`label[for="${inp.id}"]`);
            if (lbl) label = lbl.textContent || '';
          }
          if (!label && inp.closest('label')) label = inp.closest('label')!.textContent || '';
          return {
            tag: inp.tagName.toLowerCase(),
            type: inp.type,
            name: inp.name,
            id: inp.id,
            placeholder: inp.placeholder,
            label: label.trim(),
          };
        });
    }, undefined, { timeout: 8000 });

    const mapped = mapFields(descriptors);
    let fieldsFilled = 0;
    for (const role of Object.keys(mapped) as FieldRole[]) {
      const d = mapped[role]!;
      // Prefer name/id selectors; fall back to placeholder, then type — many
      // real forms (e.g. footer newsletter widgets) ship inputs with no name/id.
      let sel: string | null = d.name ? `[name="${d.name}"]` : d.id ? `[id="${d.id}"]` : null;
      if (!sel && d.placeholder) sel = `[placeholder="${d.placeholder}"]`;
      if (!sel && d.type && d.type !== 'text') sel = `${d.tag}[type="${d.type}"]`;
      if (!sel) continue;
      try {
        await form.locator(sel).first().fill(String(data[role]), { timeout: 5000 });
        fieldsFilled++;
      } catch {
        // ignore individual fill failures
      }
    }

    const urlBefore = page.url();
    let submitted = false;
    try {
      const submitBtn = form.locator('button[type="submit"], input[type="submit"], button:not([type])').first();
      if (await submitBtn.count()) {
        await submitBtn.click({ timeout: 5000 });
      } else {
        await form.evaluate((el: Element) => (el as HTMLFormElement).requestSubmit());
      }
      submitted = true;
      await page.waitForTimeout(1500);
    } catch {
      submitted = false;
    }

    const html = await page.content();
    const urlChanged = page.url() !== urlBefore;
    const formStillPresent = (await page.locator('form').nth(fi).count()) > 0;
    const hasCaptchaNow = await page.locator('.g-recaptcha, iframe[src*="recaptcha"]').count();
    const onScreenSuccess = detectSuccess({
      html,
      urlChanged,
      formStillPresent,
      hasCaptcha: hasCaptchaNow > 0,
    });

    const screenshot = opts.screenshotDir
      ? await captureFormShot(page, form, opts.screenshotDir, shotName(pageUrl, fi))
      : undefined;

    results.push({
      pageUrl,
      formId: signals.formId,
      fieldsFilled,
      submitted,
      onScreenSuccess,
      marker,
      screenshot,
      status: onScreenSuccess ? FormCheckStatus.Pass : submitted ? FormCheckStatus.Fail : FormCheckStatus.Error,
      notes: onScreenSuccess
        ? undefined
        : submitted
          ? 'Submitted but no on-screen success detected.'
          : 'Could not submit form.',
    });
    } catch (err) {
      // One uncooperative form (hidden/detached/slow) must not abort the whole site.
      results.push({
        pageUrl,
        formId: `form-${fi}`,
        fieldsFilled: 0,
        submitted: false,
        onScreenSuccess: false,
        marker,
        status: FormCheckStatus.Error,
        notes: `Form #${fi} could not be evaluated: ${(err as Error).message.split('\n')[0]}`,
      });
    }
  }

  return results;
}

/**
 * Crawl a site and run form checks. Pages are discovered via sitemap.xml when
 * available, otherwise via bounded BFS. Always respects maxPages + visitedCap.
 */
export async function crawlAndCheckForms(baseUrl: string, opts: FormCheckOpts): Promise<FormResult[]> {
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const visitedCap = opts.visitedCap ?? DEFAULT_VISITED_CAP;
  const runId = opts.runId ?? `run-${Date.now()}`;
  const marker = makeMarker(opts.markerPrefix ?? 'QA-TEST', baseUrl, runId);

  const context = await opts.browser.newContext();
  const page = await context.newPage();
  const results: FormResult[] = [];

  const visited = new Set<string>();
  const queue: string[] = [];

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (err) {
    await context.close();
    return [
      {
        pageUrl: baseUrl,
        fieldsFilled: 0,
        submitted: false,
        onScreenSuccess: false,
        marker,
        status: FormCheckStatus.Error,
        notes: `Navigation failed: ${(err as Error).message}`,
      },
    ];
  }

  // Seed the queue: sitemap first, else BFS from the landing page.
  const sitemapUrls = opts.maxPages === undefined ? [] : await discoverFromSitemap(page, baseUrl);
  const fromSitemap = sitemapUrls.length > 0;
  if (fromSitemap) {
    for (const u of sitemapUrls) queue.push(u);
  } else {
    queue.push(normalizeUrl(baseUrl));
  }

  let pagesChecked = 0;
  while (queue.length > 0 && pagesChecked < maxPages && visited.size < visitedCap) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      if (page.url() !== url) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    } catch {
      continue;
    }

    pagesChecked++;
    const pageResults = await checkFormsOnPage(page, marker, opts);
    results.push(...pageResults);

    // Expand BFS frontier only when not using a sitemap.
    if (!fromSitemap && pagesChecked < maxPages) {
      try {
        const links = await collectLinks(page, baseUrl);
        for (const l of links) {
          if (!visited.has(l) && !queue.includes(l)) queue.push(l);
        }
      } catch {
        // ignore link collection failures
      }
    }
  }

  await context.close();

  if (results.length === 0) {
    return [
      {
        pageUrl: baseUrl,
        fieldsFilled: 0,
        submitted: false,
        onScreenSuccess: false,
        marker,
        status: FormCheckStatus.NoForms,
        notes: `No forms found across ${pagesChecked} page(s).`,
      },
    ];
  }

  return results;
}
