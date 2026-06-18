/**
 * Self-contained HTML report generator (one per site).
 *
 * Produces a single report.html with form screenshots embedded as base64 data
 * URIs — so the file is portable (email it, drop it in Drive) with no loose
 * image dependencies. Raw PNGs still live in <runDir>/shots/ for reuse.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CallButtonResult, FormResult } from '../types';

export interface SiteReportInput {
  url: string;
  formStatus: string;
  callStatus: string;
  forms: FormResult[];
  calls: CallButtonResult[];
  generatedAt: string;
}

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  );
}

function badge(status: string): string {
  const s = status.toUpperCase();
  const cls =
    s === 'PASS' ? 'ok' : s === 'FAIL' ? 'bad' : s === 'NOT_SWAPPED' || s === 'ERROR' ? 'warn' : 'muted';
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

async function imgDataUri(runDir: string, rel?: string): Promise<string | null> {
  if (!rel) return null;
  try {
    const buf = await readFile(join(runDir, rel));
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function formRow(runDir: string, f: FormResult): Promise<string> {
  const uri = await imgDataUri(runDir, f.screenshot);
  const shot = uri
    ? `<a href="${uri}" target="_blank"><img class="shot" src="${uri}" alt="form screenshot"/></a>`
    : '<span class="muted">no screenshot</span>';
  const delivery = f.delivery
    ? `${f.delivery.method}: ${f.delivery.delivered ? '✅ delivered' : '❌ not confirmed'}`
    : '—';
  return `<tr>
    <td>${esc(f.pageUrl)}</td>
    <td>${badge(f.status)}</td>
    <td>${f.fieldsFilled}</td>
    <td>${f.submitted ? 'yes' : 'no'}</td>
    <td>${f.onScreenSuccess ? '✅' : '—'}</td>
    <td>${esc(delivery)}</td>
    <td>${esc(f.notes || '')}</td>
    <td>${shot}</td>
  </tr>`;
}

function callRow(c: CallButtonResult): string {
  const swap = c.numberSwapped
    ? `✅ <code>${esc(c.hrefBefore)}</code> → <code>${esc(c.hrefAfter)}</code>`
    : c.hrefBefore
      ? `<code>${esc(c.hrefBefore)}</code> (no swap)`
      : '—';
  return `<tr>
    <td>${esc(c.pageUrl)}</td>
    <td>${esc(c.selector)}</td>
    <td>${c.swapScriptPresent ? '✅ present' : '❌ absent'}</td>
    <td>${swap}</td>
    <td>${c.numberSwapped ? '✅ yes' : '❌ no'}</td>
    <td>${badge(c.status)}</td>
    <td>${esc(c.notes || '')}</td>
  </tr>`;
}

/** Build the report and write <runDir>/report.html. Returns the file path. */
export async function generateSiteReport(input: SiteReportInput, runDir: string): Promise<string> {
  const formRows = (await Promise.all(input.forms.map((f) => formRow(runDir, f)))).join('\n');
  const callRows = input.calls.map(callRow).join('\n');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>QA Report — ${esc(input.url)}</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif; margin: 0; background:#0b0b0c; color:#e7e7ea; }
  .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 32px 0 12px; border-bottom:1px solid #27272a; padding-bottom:6px; }
  .meta { color:#a1a1aa; font-size:13px; margin-bottom:20px; }
  .summary { display:flex; gap:16px; flex-wrap:wrap; margin:16px 0; }
  .card { background:#161618; border:1px solid #27272a; border-radius:12px; padding:14px 18px; }
  .card .lbl { color:#a1a1aa; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th,td { text-align:left; padding:8px 10px; border-bottom:1px solid #1f1f22; vertical-align:top; }
  th { color:#a1a1aa; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:.04em; }
  code { background:#1f1f22; padding:1px 5px; border-radius:5px; font-size:12px; }
  .shot { max-width:220px; border:1px solid #27272a; border-radius:8px; display:block; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
  .badge.ok{background:#064e3b;color:#6ee7b7} .badge.bad{background:#4c0519;color:#fda4af}
  .badge.warn{background:#451a03;color:#fcd34d} .badge.muted{background:#27272a;color:#a1a1aa}
  .muted{color:#71717a} .note{color:#a1a1aa;font-size:12px;margin-top:6px}
</style></head><body><div class="wrap">
  <h1>Form &amp; Call-Button QA — ${esc(input.url)}</h1>
  <div class="meta">Generated ${esc(input.generatedAt)}</div>
  <div class="summary">
    <div class="card"><div class="lbl">Forms</div><div>${badge(input.formStatus)} <span class="muted">${input.forms.length} checked</span></div></div>
    <div class="card"><div class="lbl">Call buttons</div><div>${badge(input.callStatus)} <span class="muted">${input.calls.length} found</span></div></div>
  </div>

  <h2>Forms</h2>
  ${input.forms.length
    ? `<table><thead><tr><th>Page</th><th>Status</th><th>Fields</th><th>Submitted</th><th>Success</th><th>Delivery</th><th>Notes</th><th>Screenshot (proof)</th></tr></thead><tbody>${formRows}</tbody></table>`
    : '<p class="muted">No forms found.</p>'}

  <h2>Call Now buttons — CallRail check</h2>
  <p class="note">CallRail footprint = whether the CallRail swap script is present, and whether the <code>tel:</code> number was dynamically swapped to a tracking number. A swap (before → after) is the proof the button is wired to CallRail.</p>
  ${input.calls.length
    ? `<table><thead><tr><th>Page</th><th>Button</th><th>Swap script</th><th>Number (before → after)</th><th>Swapped</th><th>Status</th><th>Notes</th></tr></thead><tbody>${callRows}</tbody></table>`
    : '<p class="muted">No call buttons found.</p>'}
</div></body></html>`;

  const out = join(runDir, 'report.html');
  await writeFile(out, html, 'utf-8');
  return out;
}
