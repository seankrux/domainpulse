/**
 * CallRail "Call Now" button QA engine.
 *
 * Runs server-side under Node via the `playwright` chromium API. Given a Page
 * that has ALREADY been navigated to the target URL, it:
 *   1. collects all tel: links / obvious click-to-call buttons,
 *   2. records the href BEFORE any CallRail DNI swap,
 *   3. detects whether a CallRail swap script (or window.CallTrk) is present,
 *   4. waits briefly for the swap to fire, re-reads the numbers,
 *   5. reports per-button status (Pass / NotSwapped / NoButtons / Fail / Error).
 *
 * The pure helpers (isCallRailScript, normalizeTel) are exported so they can be
 * unit-tested without a browser.
 */
import type { Page } from 'playwright';
import { CallCheckStatus, type CallButtonResult } from '../types';

export interface CallButtonOpts {
  /** How long to wait (ms) for the DNI swap to fire. Default 6000. */
  swapWaitMs?: number;
}

const DEFAULT_SWAP_WAIT_MS = 6000;

/**
 * Returns true if a script src looks like a CallRail DNI swap script, e.g.
 * `https://cdn.callrail.com/companies/123/abc/12/swap.js`.
 */
export function isCallRailScript(src: string | null | undefined): boolean {
  if (!src) return false;
  return /callrail\.com\/.+\/swap\.js/i.test(src);
}

/**
 * Normalize a tel: href to a comparable digit string.
 * Strips the `tel:` scheme, whitespace, and formatting punctuation while
 * preserving a leading `+`. Returns '' for empty/placeholder values.
 */
export function normalizeTel(href: string | null | undefined): string {
  if (!href) return '';
  let v = href.trim();
  if (/^tel:/i.test(v)) v = v.slice(4);
  v = v.trim();
  // Treat obvious placeholders as empty.
  if (/^(#|javascript:void\(0\)?|placeholder|n\/a)$/i.test(v)) return '';
  const hasPlus = v.trimStart().startsWith('+');
  const digits = v.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return hasPlus ? `+${digits}` : digits;
}

/** A snapshot of a click-to-call element read from the DOM. */
interface TelSnapshot {
  selector: string;
  href: string;
}

const TEL_SELECTOR = 'a[href^="tel:"], [data-tel], button[onclick*="tel:"]';

/** Read all click-to-call elements + their tel value from the page. */
async function readTelElements(page: Page): Promise<TelSnapshot[]> {
  return page.$$eval(TEL_SELECTOR, (els) =>
    els.map((el, i) => {
      const a = el as HTMLElement;
      const href =
        a.getAttribute('href') ||
        a.getAttribute('data-tel') ||
        a.getAttribute('onclick') ||
        '';
      // Build a stable-ish selector for reporting.
      const id = a.id ? `#${a.id}` : '';
      const cls = a.className && typeof a.className === 'string' ? `.${a.className.split(/\s+/).filter(Boolean).join('.')}` : '';
      const selector = id || cls || `${a.tagName.toLowerCase()}[tel]:nth(${i})`;
      return { selector, href };
    })
  );
}

/** Detect a CallRail swap script or the window.CallTrk global. */
async function detectSwapScript(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const re = /callrail\.com\/.+\/swap\.js/i;
    const hasScript = scripts.some((s) => re.test((s as HTMLScriptElement).src));
    const hasGlobal = typeof (window as unknown as { CallTrk?: unknown }).CallTrk !== 'undefined';
    return hasScript || hasGlobal;
  });
}

/**
 * Check every click-to-call button on an already-navigated Page.
 */
export async function checkCallButtons(
  page: Page,
  opts: CallButtonOpts = {}
): Promise<CallButtonResult[]> {
  const swapWaitMs = opts.swapWaitMs ?? DEFAULT_SWAP_WAIT_MS;
  const pageUrl = page.url();

  let before: TelSnapshot[];
  let swapScriptPresent: boolean;
  try {
    before = await readTelElements(page);
    swapScriptPresent = await detectSwapScript(page);
  } catch (err) {
    return [
      {
        pageUrl,
        selector: '*',
        swapScriptPresent: false,
        numberSwapped: false,
        status: CallCheckStatus.Error,
        notes: `Failed to read page: ${(err as Error).message}`,
      },
    ];
  }

  if (before.length === 0) {
    return [
      {
        pageUrl,
        selector: '*',
        swapScriptPresent,
        numberSwapped: false,
        status: CallCheckStatus.NoButtons,
        notes: 'No tel: links or click-to-call buttons found.',
      },
    ];
  }

  // Wait for the DNI swap to fire, then re-read.
  if (swapScriptPresent) {
    await page.waitForTimeout(swapWaitMs);
  }
  let after: TelSnapshot[] = before;
  try {
    after = await readTelElements(page);
  } catch {
    // keep `before` if re-read fails; reported per-button below
  }

  const results: CallButtonResult[] = [];
  for (let i = 0; i < before.length; i++) {
    const b = before[i];
    if (!b) continue;
    const a = after[i];
    const hrefBefore = b.href;
    const hrefAfter = a ? a.href : b.href;
    const normBefore = normalizeTel(hrefBefore);
    const normAfter = normalizeTel(hrefAfter);
    const numberSwapped = normBefore !== normAfter;

    let status: CallCheckStatus;
    let notes: string | undefined;
    if (!normAfter) {
      status = CallCheckStatus.Fail;
      notes = 'Empty or placeholder tel: number.';
    } else if (!swapScriptPresent) {
      status = CallCheckStatus.NotSwapped;
      notes = 'No CallRail swap script detected; number is static.';
    } else if (!numberSwapped) {
      status = CallCheckStatus.NotSwapped;
      notes = 'Swap script present but the number never changed.';
    } else {
      status = CallCheckStatus.Pass;
    }

    results.push({
      pageUrl,
      selector: b.selector,
      hrefBefore,
      hrefAfter,
      swapScriptPresent,
      numberSwapped,
      status,
      notes,
    });
  }

  return results;
}
