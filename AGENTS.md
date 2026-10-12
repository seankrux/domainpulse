# AGENTS.md — Invariants & Guardrails for DomainPulse

> **Read this before changing monitoring, status, theming, or filter code.**
> This file exists so that different agents (Claude, Gemini, Qwen, etc.) don't
> re-introduce bugs that have already been fixed. If you change a behavior
> described here, update this file in the same PR.

---

## 1. Domain liveness — the single source of truth

**Liveness is decided ONLY by the uptime check (`/api/check` →
`safeHeadRequest`). SSL, DNS, WHOIS/expiry and tech-detection are
*enrichment* and must NEVER change a domain's ALIVE/DOWN status.**

Why this rule exists: enrichment sub-checks used to run inside `Promise.all`,
so a single rejected call (e.g. an expired auth token throwing `Unauthorized`)
turned a perfectly **alive** domain into **Error**. That produced the
"seanguillermo shows Error" and amber "200 OK" bug reports.

Contract — in `services/domainService.ts` (`checkDomainWithSSL`):
- The uptime result sets `status` / `statusCode` / `latency`.
- Enrichment runs via **`Promise.allSettled`**, never `Promise.all`.
- A rejected enrichment promise falls back to a safe default
  (`SSLStatus.Unknown`, `{ status: 'unknown' }`, `undefined`, `confidence: 'low'`).
- **Do not** revert this to `Promise.all`.

## 2. What counts as "up" — `isReachableStatus`

In `api/_utils/ssrfGuard.ts`:

```
isReachableStatus(status) === status > 0 && status < 500
```

A server answering with **401 / 403 / 404 / 405 / 429** is **reachable** and
therefore **ALIVE**. Only **5xx** or **no response (status 0)** is DOWN.

Reason: the uptime probe uses `HEAD`. Many real sites reject `HEAD` (amazon.com
→ 405) or block bot user-agents (→ 403). Treating only 2xx as "up" falsely
flagged those domains offline.

Also in `safeHeadRequest`: when `HEAD` returns **405 or 501**, we retry **once
with `GET`** to recover the true status. Keep this fallback.

The `/api/check` flow lives in **`probeUptime(url)`** in `ssrfGuard.ts` — the
**single source of truth** shared by the Vercel function (`api/check.ts`) and
the dev proxy (`server/proxy.ts`). It returns a ready-to-send `{ httpStatus,
body }`. **Do not** hand-roll the probe/mapping in either endpoint; call
`probeUptime` so the two environments can never disagree. It:
- runs `safeHeadRequest` (→ `toCheckResult`, still the ALIVE/DOWN mapper);
- **canonicalises www↔apex**: if the host doesn't resolve, it retries once with
  `www.` toggled (`toggleWww`) — so "I added `example.com` but it only serves
  `www.example.com`" (or vice-versa) resolves correctly;
- maps a **genuinely unresolvable** domain (NXDOMAIN) to **DOWN**, not to a 400
  / `Error`. Only an SSRF/scheme reject (private address, non-http) returns
  HTTP 400. The `unresolvable` flag on `SafeHeadResult` (set from the
  `validateOutboundUrlResolved` failure `code`) is what distinguishes "dead
  domain → DOWN" from "blocked target → 400". **Do not** collapse these back
  into one branch.

Locked in by `tests/unit/ssrf.test.ts` ("isReachableStatus (liveness
contract)", "toCheckResult (shared liveness mapping)", "toggleWww", and
"probeUptime (canonicalisation + liveness mapping)").

## 3. Status badge text vs colour

In `components/StatusBadge/StatusBadge.tsx`: the HTTP code (e.g. "200 OK") is
shown **only when `status` is `Alive` or `Down`**. Never show the code for
`Error` / `Unknown` / `Checking` — otherwise a stale `statusCode` renders as
"200 OK" under the amber Error colour (the exact bug from the screenshots).

Status colours live in `theme/statusColors.ts` (`STATUS_COLORS`) and are the
**single source of truth**. Never inline status colour strings in components.
- Alive → emerald, Down → red, Checking → blue, Unknown → zinc, Error → amber.

## 4. Filtering & sorting (`App.tsx → displayDomains`)

- Filter matching keys off `status`, `ssl.status`, `groupId`, and a lowercased
  URL substring search. This is correct — don't "simplify" it.
- **Sort comparators must use `??`, not `||`, for order lookups.** The order
  maps start at `0` (e.g. `Valid: 0`, `active: 0`); `0 || fallback` wrongly
  yields the fallback. Use `sslOrder[x] ?? 4` and `expiryOrder[x] ?? 3`.

## 5. Auth token — one storage, one reader

**The session token is written by `AuthProvider` to `sessionStorage` (key
`domainpulse_auth_session`). The ONLY client-side reader is
`getSessionToken()` in `utils/authSession.ts`. Every service/hook that attaches
a `Bearer` token MUST go through it.**

Why this rule exists: services each kept a private `getStoredToken()` that read
`localStorage`, but the token lives in `sessionStorage`. The read returned
`null`, so no `Authorization` header was sent, `/api/check` answered `401`, and
the client threw `Unauthorized` → an otherwise **ALIVE** domain showed as
**Error**. Bulk import worked (it read `sessionStorage`), single add/re-check
did not — the "alive shows Error / inconsistent" report.

Contract:
- Read the token ONLY via `getSessionToken()`. **Never** call
  `localStorage.getItem('domainpulse_auth_session')` or hand-roll a
  `sessionStorage` parse in a service.
- `checkSingleDomain` and `checkBatch` must BOTH pass `authToken` in
  `ServiceConfig` (the Web Worker has no `sessionStorage`, so the token has to
  be read on the main thread and handed in).
- Locked in by `tests/unit/authSession.test.ts` and
  `tests/unit/checkDomainWithSSL.test.ts`.

---

## 8. Rate limiting — bulk checks share one budget; the client must back off

Every `/api/*` endpoint shares ONE per-IP request budget
(`lib/config.ts → rateLimit`). A single domain check fans out to ~8 calls
(`/api/check` + ssl/whois/dns/tech-detect/canonical/email-auth/security-headers),
so a bulk run legitimately makes thousands of calls per window.

Contract:
- **Client 429 handling is mandatory, not optional.** `services/apiClient.ts →
  fetchWithRetry` retries `429` honouring `Retry-After` with capped exponential
  backoff, and never sleeps past the `deadline` in `ServiceConfig`. Every service
  that calls an API endpoint goes through it. **Never** bare-`fetch` an endpoint
  and treat the result as truth without handling `429` — a `429` on
  `/api/check` used to surface an ALIVE domain as Error, and a `429` on an
  enrichment call silently degraded it to defaults.
- The probe's `deadline` (`checkDomainWithSSL`) is passed down to enrichment via
  `ServiceConfig.deadline` so a backoff can't overrun the check budget and
  re-introduce the slow-check → Error bug (§6).
- The budget is deliberately generous (`maxRequests`) because it guards against
  abuse, not normal monitoring. Keep the worker's concurrency modest
  (`services/monitoring.worker.ts` chunk size + inter-chunk delay).
- Locked in by `tests/unit/apiClient.test.ts`.

---

## 9. Untrusted rendered HTML must be sanitized

`markdownToHtml` (`lib/content.ts`) is the single choke point for rendered
markdown → HTML, and it runs `DOMPurify.sanitize` before the result reaches
`dangerouslySetInnerHTML` (`components/ContentRenderer.tsx`). Markdown often
comes from someone other than the operator, so raw `<script>`/`onerror=`
must never become executable. **Do not** render `marked.parse(...)` output
straight into the DOM. Locked in by `tests/unit/contentSanitize.test.ts`.

---

## 7. Auth is opt-in — public when no password is configured

**Auth is opt-in.** When no password hash is configured the API allows
unauthenticated requests and `AuthGuard` skips the login portal (public demo).
When the hash **is** set, the API requires a Bearer JWT and `AuthGuard` shows
the lock/login gate until `POST /api/login` succeeds.

- Password hash env: prefer server-only `PASSWORD_HASH` (`hash:salt`). Legacy
  `VITE_PASSWORD_HASH` still works. Avoid `VITE_` so the hash is not eligible
  for the client bundle.
- `verifyAuth` (`api/_utils/auth.ts`) returns `true` when no hash is set
  (public/demo mode), and only requires a valid Bearer token when a hash
  IS set. This mirrors the dev proxy (`server/proxy.ts`) — prod and dev must agree.
- `AuthGuard` asks `GET /api/auth-status` (`{ authRequired }`): `false` →
  render the dashboard; `true` → show `LoginPage` (lock UI) until authenticated.
  `/api/auth-status` exists on both Vercel (`api/auth-status.ts`) and the proxy.
  `AuthGuard` **fails open** to public mode if the status probe errors; a
  protected API still 401s → `auth-invalid` → re-probe → login page.
- `JWT_SECRET` is required **only when auth is enabled** (`VITE_PASSWORD_HASH`
  set) in production. Don't reinstate an unconditional "deny all / throw in
  production when unconfigured".
- The session token must flow through `getSessionToken()` (see §5).
- Locked in by `tests/unit/auth.test.ts` and `tests/unit/AuthGuard.test.tsx`.

## 6. Timeout guards liveness only — never enrichment

In `checkDomainWithSSL` the hard timeout (`serviceConfig.timeout`) wraps ONLY
the uptime probe (`resolveLiveness`). Once liveness is known, enrichment runs
under `Promise.allSettled` **and** a soft timeout (`raceToDefault`) that
**resolves to safe defaults** instead of rejecting. A slow OR failing
enrichment can therefore never flip an ALIVE domain to Error — `Error` is
reachable only when the probe itself fails (auth/network/timeout). Do **not**
re-wrap the whole check (liveness + enrichment) in one rejecting timeout race;
that was the loophole that let slow SSL/WHOIS calls produce false Error.

---

## 10. Dev/prod route parity is guarded by a test

`tests/unit/routeParity.test.ts` statically checks that the `/api/*` routes the
frontend services call are served by **both** the dev proxy (`server/proxy.ts`)
and a Vercel function (`api/*.ts`), that the two route sets are identical, and
that every outbound endpoint delegates to its single `api/_utils/*` lookup util.
Adding a frontend call to a new endpoint without adding the proxy + `api/` route
(or reimplementing a lookup inline) now fails CI. Extend that map when you add an
endpoint.

---

## Filtering/sorting is a tested pure module

`App.tsx` delegates `displayDomains` to `utils/domainFilters.ts →
filterAndSortDomains()`. Keep the filtering keys (status, ssl.status, groupId,
lowercased url) and the zero-indexed sort maps (`??`, never `||`) intact — the
`??`-vs-`||` zero-index regression is locked in by `tests/unit/domainFilters.test.ts`.

---

## Known gaps (intentionally not fixed yet — don't "fix" silently)

1. **Light mode is not implemented.** The app is dark-only: the shell uses
   hardcoded dark classes (`bg-zinc-950`, `text-zinc-100`) with almost no
   `dark:` variants. The header no longer shows a dark-mode toggle (it was a
   no-op). Building real light mode is a large, app-wide effort. **Decision:
   leave as-is for now** unless doing a full scoped theming pass.

2. **Node-side QA alerting is not wired.** `scripts/qa-crawl.ts` exits non-zero
   on a failing crawl but does not dispatch Slack/Discord/email alerts (its
   `TODO`), and `qa/delivery/index.ts` has unimplemented delivery verifiers — both
   are **blocked on credentials** (a Node alert channel / provider keys), not on
   code. **Decision:** leave the explicit hooks; enable once secrets exist.

---

## Fix log (2026-10-12, round 2) — test guards for parity, filtering, monitoring

- Added `tests/unit/routeParity.test.ts` (§10): the dev proxy and Vercel
  functions must expose the same `/api/*` routes the frontend calls, and each
  outbound endpoint must delegate to its shared `api/_utils/*` util. Closes the
  "no automated route-parity check" gap.
- Extracted `utils/domainFilters.ts` (pure `filterAndSortDomains`) from
  `App.tsx → displayDomains`; `tests/unit/domainFilters.test.ts` locks in the
  zero-indexed `??`-not-`||` ordering contract (§4) across every sort field.
- `tests/unit/useMonitoring.test.tsx`: covers the empty-batch
  `isCheckingAll`-stranding guard, token propagation (§5), enrichment-timeout
  preservation, history trimming and the auth-invalid dispatch.
- `tests/unit/contentLoader.test.ts`: frontmatter parsing, post date-sorting and
  graceful degradation of `lib/content.ts`.
- Accessibility: `App.tsx` now actually calls `useAnnounce().announce()` for
  add / bulk-import / domain-down (assertive) / domain-up, so the live region
  (`<Announcer/>`) announces real events instead of being rendered dead. Removed
  the two misleading `eslint-disable no-unused-vars` comments on the (in fact
  used) `useAnnounce` import + destructure.
- Coverage floors raised to 56% statements/lines/functions, 46% branches
- Full suite 205 tests / 25 files; `tsc` clean; lint error-free; both builds green.

---

## Fix log (2026-10-12) — rate-limit-aware client, XSS sanitize, validation, ids

- **429 handling (new §8):** `services/apiClient.ts → fetchWithRetry` retries
  `429` with `Retry-After`/backoff bounded by the check `deadline`; wired into
  `domainService` + the eight enrichment services. Raised the shared budget
  (`lib/config.ts`) and made the worker's concurrency gentler. A `429` no longer
  reports an ALIVE domain as Error. Tests: `tests/unit/apiClient.test.ts`.
- **XSS (new §9):** `markdownToHtml` now runs `DOMPurify.sanitize` before the
  HTML reaches `dangerouslySetInnerHTML`. Tests: `tests/unit/contentSanitize.test.ts`.
- **Input validation:** `validateAndNormalizeUrl` parses the host out before
  applying scheme/`@`/`..`/NUL checks, so a path containing `@` or `..` is no
  longer false-rejected while host-position injections still are.
- **Ids:** `utils/id.ts → generateId()` (`crypto.randomUUID`) replaces four
  copies of the collision-prone, deprecated `Math.random().toString(36).substr(2,9)`.
- **Tests/CI:** SSRF guard coverage 60%→75% (isBlockedIp boundaries,
  `probeRedirectChain`); coverage `thresholds` added to `vitest.config.ts`.
- Tests: `ssrf.test.ts`, `domainService.test.ts` extended.

---

## Fix log (2026-07-05) — www↔apex canonicalisation + unresolvable → DOWN

- **Symptom ("I added domains; some check the www, some non-www didn't"):** a
  domain typed in the form that doesn't resolve (apex when only `www` has an A
  record, or vice-versa) hit `dns.lookup` NXDOMAIN → SSRF guard returned
  `Host did not resolve` → `/api/check` replied `400 Blocked` → the client saw
  `!response.ok`, exhausted endpoints, and surfaced amber **Error**. No attempt
  was ever made on the other canonical form.
- Fix: new shared `probeUptime()` in `ssrfGuard.ts` (used by `api/check.ts` +
  `server/proxy.ts`). On a non-resolving host it retries once with `www.`
  toggled (`toggleWww`); a still-unresolvable domain maps to **DOWN** (a real
  negative signal), while SSRF/scheme rejects still return `400`. The
  `unresolvable` discriminator (from `validateOutboundUrlResolved`'s failure
  `code`) is what keeps "dead domain → DOWN" separate from "private → 400".
  This also closes former known-gap #2. See §2.
- Tests: `tests/unit/ssrf.test.ts` ("toggleWww", "probeUptime …").

## Fix log (2026-06-22) — login-less demo returned 401 → Error

- **Primary symptom ("added domain shows Error even though alive"):** the
  front end's `AuthGuard` is a "skip authentication" stub, so it never logs in
  and sends no token — but `verifyAuth` denied unauthenticated requests
  (`401`), so every freshly-checked domain showed Error. Reproduced live:
  fresh `cloudflare.com` → amber Error + two `401`s in the console.
- Fix: auth is now opt-in. `verifyAuth` allows requests when no
  `VITE_PASSWORD_HASH` is configured (matches the dev proxy); `JWT_SECRET` is
  required only when auth is enabled. After the fix the same flow shows
  `cloudflare.com` → 200 OK / Operational. See §7.
- Tests: `tests/unit/auth.test.ts`.

## Fix log (2026-06-22) — token storage + timeout

- **Root cause of "alive domain shows Error when added":** `AuthProvider` writes
  the session to `sessionStorage`, but `domainService`/`sslService`/`dnsService`/
  `gmbService`/`expiryService` each read it from `localStorage` (only
  `techDetectionService` read the right store). The token came back `null` →
  `401` → `Unauthorized` thrown → `Error`. `checkSingleDomain` also passed no
  token at all, so single add/re-check failed while bulk import (which read
  `sessionStorage`) succeeded — the "inconsistent" symptom.
- Fix: new `utils/authSession.ts` `getSessionToken()` is the single client-side
  token reader (reads `sessionStorage`). All six services + `useMonitoring` now
  use it; the six duplicated `getStoredToken()` copies are deleted.
  `checkSingleDomain` now passes `authToken` like `checkBatch`.
- Fix: `checkDomainWithSSL` restructured — hard timeout guards only the liveness
  probe; enrichment uses `allSettled` + a soft `raceToDefault` timeout so a slow
  enrichment can't time-out the whole check into Error (see §6). Timers are now
  cleared (no dangling `setTimeout`).
- Tests: `tests/unit/authSession.test.ts` (token source of truth) +
  `tests/unit/checkDomainWithSSL.test.ts` (liveness invariant incl. hang).

## Fix log (2026-06-21/22)

- `ssrfGuard.ts`: added `isReachableStatus` (up = status < 500) + `GET`
  fallback on 405/501. Fixes false-offline for amazon.com and HEAD-rejecting sites.
- `domainService.ts`: enrichment moved to `Promise.allSettled` so a failed
  SSL/DNS/WHOIS/tech call no longer downgrades an alive domain to Error.
- `StatusBadge.tsx`: HTTP code shown only for Alive/Down (kills amber "200 OK").
- `App.tsx`: sort order lookups use `??` instead of `||` (zero-index bug).
- `tests/unit/ssrf.test.ts`: liveness contract tests added.
- Refactor: extracted `CheckResult` + `toCheckResult()` into `ssrfGuard.ts`,
  removing the duplicated probe→response mapping from `api/check.ts` and
  `server/proxy.ts` (prevents prod/dev drift). Behavior-preserving; covered by tests.
- Cleanup: extracted `sslLookup.ts` / `dnsLookup.ts` / `whoisLookup.ts` into
  `api/_utils`. `api/ssl|dns|whois.ts` and the dev proxy now share ONE
  implementation each. The dev proxy's fake "Local Simulation Registrar" WHOIS
  is gone — local now matches production. Removed stale review/handoff docs
  (superseded by this file) and a tracked vitest temp artifact.

## Enrichment endpoints — one implementation each

`ssl`, `dns`, `whois`, `gmb`, `tech-detect`, `canonical`, `email-auth`,
`security-headers` each have a Vercel function
(`api/*.ts`) AND a dev proxy route (`server/proxy.ts`). The actual lookup logic
lives ONCE in `api/_utils/{sslLookup,dnsLookup,whoisLookup,gmbLookup,techLookup,canonicalLookup,emailAuthLookup,securityHeadersLookup}.ts`.
Both sides import it. **Never** reimplement a lookup inline in an endpoint or
the proxy — extend the shared util so prod and dev can't diverge. The proxy
must serve every `/api/*` route the frontend services call
(`check, ssl, dns, whois, gmb, tech-detect, canonical, email-auth, security-headers, auth-status, login`) or that feature breaks in dev.

All outbound-fetching utils (`check`, `tech-detect`, `security-headers`) go through the SSRF guard
(`validateOutboundUrlResolved` / `safeHeadRequest`). Keep it that way.

---

## Cursor Cloud specific instructions

Dependencies are refreshed automatically on startup (`npm ci --legacy-peer-deps`);
you do not need to reinstall. Standard commands live in `package.json` and the
README "Available Commands" table — use those. Non-obvious caveats only:

- **Node 22** is used here (`.nvmrc` = 22; `engines` requires >=20). Fine as-is.
- **Installs use `--legacy-peer-deps` to match CI.** Plain `npm ci` currently
  works too, but CI (`.github/workflows/ci.yml`) and the startup update script
  both pass `--legacy-peer-deps` to stay resilient to peer-range drift; prefer
  it for manual installs so you match CI.
- **Two apps, three dev ports.** `npm run dev:all` runs the dashboard on
  `:3000` **and** the Express proxy on `:3001` together (via `concurrently`) —
  the dashboard is non-functional without the proxy, which Vite proxies `/api/*`
  to. `npm run dev` runs the separate marketing site on `:3002`. Verify the
  dashboard against `:3000`, not `:3001`.
- **Runs login-less with no secrets.** No `.env.local` is needed: with
  `VITE_PASSWORD_HASH` unset the API allows unauthenticated requests (see §7),
  and missing `GOOGLE_PLACES_API_KEY` only degrades GMB checks to "Unknown".
  Domain checks make real outbound HTTP/DNS/TLS calls, so live results depend on
  network egress from the VM.
- **Unit vs GUI tests are separate runners.** `npm run test`/`test:unit`
  (Vitest, jsdom) need no browser. `npm run test:gui` (Playwright) needs a
  browser first: `npx playwright install chromium` (not part of the update
  script). Playwright auto-starts its own servers via `webServer`.
