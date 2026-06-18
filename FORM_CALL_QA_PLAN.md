# Form & Call-Button QA — Build Plan

**Goal:** Extend DomainPulse into a "smart QA tool": drop in a set of websites, it crawls
each one, **tests every form** (submit + verify delivery), and **verifies every "Call Now"
button** is wired to a working CallRail tracking number. Runs **on-demand** and on a
**schedule**, alerts to multiple platforms, and shows results in the existing dashboard.
Then deploy to **Vercel** and wrap a reusable **Claude skill** — but only after **rigorous,
adversarial testing**.

Source of truth: `Downloads/domainpulse` (newer than the Documents copy — commit 2026-06-18).

---

## 0. Why extend DomainPulse instead of building new

It already provides ~80% of the plumbing this tool needs:

| Requirement | Already in repo |
|---|---|
| Drop in many sites | CSV bulk import/export |
| Run checks across sites | `services/monitoring.worker.ts` batch engine |
| On-demand + scheduled | Dashboard triggers + `.github/workflows/` |
| Alert to many platforms | `notificationService.ts` + `WebhookConfig` (slack/discord) + Resend email |
| Dashboard + client-facing view | Dashboard + public status page |
| Browser automation | Playwright installed |
| Backend for cross-origin checks | `server/proxy.ts` + `api/*.ts` Vercel functions |
| Secure access | JWT auth (`api/_utils/auth.ts`) |

We add **two new check types** following the existing `*Service.ts` pattern:
`formCheckService` and `callButtonService`.

---

## 1. Architecture decision (the important one)

Existing checks (SSL/DNS/WHOIS/uptime) are fast HTTP calls → fine as Vercel `api/*.ts`
functions. **Form crawling and CallRail swap-detection are NOT** — they need a real headless
browser and can run for minutes per site. Vercel functions time out (10–60s) and bundling
full Playwright exceeds size limits.

**Decision — split the workload:**

- **Heavy crawls (form + call checks):** run in a dedicated **GitHub Actions job**
  (`.github/workflows/qa-crawl.yml`) — scheduled (cron) **and** manually triggerable
  (`workflow_dispatch`). This is your "scheduled + on-demand" requirement, native and free.
  Playwright runs first-class here. Results are written to the data store
  (`data/` JSON now; upgrade to a DB later if needed).
- **Dashboard + light/on-demand single-site trigger:** stays on **Vercel** (the existing app).
  A "Run QA now" button can dispatch the GitHub workflow via the GitHub API, or run a
  trimmed single-page check.

This keeps Vercel fast, puts heavy work where it belongs, and reuses the dashboard for display.

---

## 2. Data model additions (`types.ts`)

```ts
export enum FormCheckStatus { Pass='PASS', Fail='FAIL', NoForms='NO_FORMS', Error='ERROR', Unknown='UNKNOWN' }
export enum CallCheckStatus { Pass='PASS', Fail='FAIL', NoButtons='NO_BUTTONS', NotSwapped='NOT_SWAPPED', Error='ERROR', Unknown='UNKNOWN' }

export interface FormResult {
  pageUrl: string;
  formId?: string;            // best-effort identifier (id/name/selector)
  fieldsFilled: number;
  submitted: boolean;
  onScreenSuccess: boolean;   // success message / thank-you detected
  marker: string;             // unique token injected into the message body
  delivery?: DeliveryResult;  // optional destination verification
  status: FormCheckStatus;
  notes?: string;
}

export interface DeliveryResult {
  method: 'email' | 'webhook' | 'crm' | 'screen-only';
  delivered: boolean;
  detail?: string;
}

export interface CallButtonResult {
  pageUrl: string;
  selector: string;
  hrefBefore?: string;        // tel: value before CallRail swap
  hrefAfter?: string;         // after swap.js runs
  swapScriptPresent: boolean;
  numberSwapped: boolean;     // hrefAfter differs from hrefBefore
  status: CallCheckStatus;
  notes?: string;
}

// extend Domain:
//   formCheck?: { status: FormCheckStatus; lastRun?: Date; results: FormResult[] };
//   callCheck?: { status: CallCheckStatus; lastRun?: Date; results: CallButtonResult[] };
```

Per-site config (extends CSV import + site record):
```jsonc
{
  "url": "clientA.com",
  "qa": {
    "crawl": { "maxPages": 25, "useSitemap": true },
    "form": {
      "enabled": true,
      "testData": { "name": "QA Test", "email": "team@merlinomarketing.com", "phone": "555-0100" },
      "marker": "QA-TEST",                 // prefix; run id + timestamp appended
      "delivery": { "type": "email", "inbox": "gmail", "match": "QA-TEST" }
    },
    "call": { "enabled": true }
  }
}
```
`delivery.type`: `email` | `webhook` | `crm` | `screen-only` (pluggable verifier modules —
adding a platform = adding one module; nothing else changes).

---

## 3. New modules

### 3a. `services/formCheckService.ts`
1. **Discover pages** — read `sitemap.xml` if present, else BFS-crawl internal links up to `maxPages`.
2. **Find forms** per page — native `<form>`, plus known embeds (Gravity Forms, HubSpot,
   Contact Form 7, Typeform/Jotform iframes). Heuristic field mapping (name/email/phone/message).
3. **Fill + submit** with test data containing a **unique marker** `QA-TEST-{site}-{runId}`
   so clients can ignore it and we can trace delivery.
4. **Verify on-screen success** — detect thank-you text, success class, URL change, or
   absence of validation errors.
5. **Verify delivery (optional)** via the verifier module declared in config.
6. Guard rails: never submit payment/login forms; respect a per-site `skipSelectors` list;
   honor robots/allowlist; rate-limit.

### 3b. `services/callButtonService.ts`
1. Collect all `a[href^="tel:"]` and common click-to-call buttons.
2. Record `href` **before** CallRail runs.
3. Detect the CallRail **swap script** (`*.callrail.com/*/swap.js`).
4. Wait for DNI swap, re-read numbers, set `numberSwapped` if changed.
5. Flag: empty/placeholder tel, no swap script, number never swapped, mismatched numbers.
   (No CallRail API needed — page-level verification. API cross-ref is a future bolt-on.)

### 3c. Delivery verifiers (`services/delivery/`)
- `emailVerifier.ts` — Gmail API / IMAP poll for the marker (token in Vercel/Actions secrets).
- `webhookVerifier.ts` — query a webhook/endpoint log for the marker.
- `crmVerifier.ts` — stub interface for HubSpot/Zoho etc. (future).
- `screenOnly.ts` — pass through on-screen success only.

### 3d. Orchestration
- `scripts/qa-crawl.ts` — entry point for the GitHub Actions job: loads site list, runs
  form + call checks via Playwright, writes results JSON, triggers alerts on failures.
- Reuse `notificationService.ts` for Slack/Discord/email alerts (extend to include QA failures).

### 3e. Dashboard UI (reuse existing component patterns)
- New badges: `FormCheckBadge`, `CallCheckBadge` (mirror `SSLBadge`/`ExpiryBadge`).
- Per-site detail drawer: list pages, forms, pass/fail, swapped numbers, delivery status.
- "Run QA now" button → dispatch GitHub workflow (or single-page quick check).

---

## 4. Scheduling & deploy

- `.github/workflows/qa-crawl.yml`: `schedule` (cron, e.g. daily 06:00) + `workflow_dispatch`
  (manual on-demand, optional `site` input). Installs Playwright browsers, runs
  `scripts/qa-crawl.ts`, commits/uploads results, posts alerts.
- **Vercel deploy** of the dashboard via existing `.github/workflows/deploy.yml` — **gated**
  on the test suite below passing (Section 5).
- Secrets: Gmail token, webhook URLs, alert webhooks → GitHub Actions secrets + Vercel env.

---

## 5. Rigorous + adversarial testing (GATE — must pass before Vercel deploy)

This is a hard gate. Deploy only after all of this is green.

**Unit (vitest)** — `tests/unit/`
- Field-mapping heuristics: weird labels, missing names, multi-step forms.
- Marker generation uniqueness; delivery-verifier matching logic.
- CallRail swap detection: before/after diff, missing script, placeholder numbers.

**Integration (Playwright)** — `tests/qa/`
- A set of **fixture HTML pages** covering: standard form, multi-field form, iframe-embedded
  form, form with no success message, form that silently fails, page with no forms.
- CallRail fixtures: real swap script mock that rewrites numbers; page with no swap; page
  where swap never fires; multiple buttons with mismatched numbers.

**Adversarial cases (must be explicitly handled, not just pass happy-path):**
- Honeypot/anti-bot fields → must not get falsely flagged or trip spam traps.
- CAPTCHA-protected form → detect and report "cannot test" rather than false pass.
- Form that shows success but never delivers → delivery verifier must catch the lie.
- Infinite/looping internal links, huge sitemaps → crawler bounded by `maxPages` + dedupe.
- Cross-origin/3rd-party iframe forms → handled or clearly reported as unsupported.
- Slow CallRail swap (fires after 5s) → adequate wait, no false "not swapped".
- Site that blocks headless UA → detect and report, don't hang.
- Idempotency: re-running doesn't spam a client with dozens of leads (per-run cap + clear marker).

**Self-review loop:** after implementation, run a `code-reviewer` + `security-scanner` pass
(secrets handling, no live submissions in CI against real client sites without an allowlist).

**Pilot:** run end-to-end against **one real consented site** before enabling the full list.

---

## 6. The Claude skill (after the app works + tests pass)

Author a skill (e.g. `form-call-qa`) that wraps the same logic for ad-hoc runs without opening
the app:
- Input: one or more URLs (+ optional delivery config).
- Action: runs the crawl → form test → call-button check (reusing `scripts/qa-crawl.ts` logic).
- Output: a concise pass/fail report per site/form/button.
- Use `skill-creator` to scaffold; keep the heavy logic in shared modules so the skill and the
  app/Action share one implementation (no divergence).

---

## 7. Build order

1. `types.ts` additions + per-site QA config + CSV import support.
2. `callButtonService.ts` (simpler) + fixtures + tests.  ← prove the pattern first
3. `formCheckService.ts` + `screenOnly` verifier + fixtures + tests.
4. `emailVerifier.ts` + `webhookVerifier.ts`.
5. `scripts/qa-crawl.ts` orchestration + `notificationService` hook.
6. Dashboard badges + detail drawer.
7. `.github/workflows/qa-crawl.yml` (scheduled + manual).
8. **Full adversarial test gate (Section 5).**
9. Vercel deploy (gated).
10. Wrap the `form-call-qa` skill.

---

## Open items to confirm before coding
- Delivery: confirm Gmail is the primary inbox (OAuth vs app-password/IMAP).
- Alert channel preference (Slack? email? both).
- Default crawl depth / max pages per site.
- Consent: which real site is the safe pilot target.
</content>
</invoke>
