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

## 7. Auth is opt-in — public when no password is configured

**The front end runs login-less (`AuthGuard` is a "skip authentication" stub),
so it sends NO token. The API must therefore allow unauthenticated requests
UNLESS a password is configured.**

- `verifyAuth` (`api/_utils/auth.ts`) returns `true` when `VITE_PASSWORD_HASH`
  is unset (public/demo mode), and only requires a valid Bearer token when it
  IS set. This mirrors the dev proxy (`server/proxy.ts`, `verifyToken` calls
  `next()` when no hash) — prod and dev must agree.
- `JWT_SECRET` is required **only when auth is enabled** (`VITE_PASSWORD_HASH`
  set) in production. Don't reinstate an unconditional "deny all / throw in
  production when unconfigured" — combined with the AuthGuard stub it returned
  `401` for every domain → ALIVE domains showed Error (the exact bug report).
- To run locked-down: set `VITE_PASSWORD_HASH` (+ `JWT_SECRET`) AND restore a
  real `AuthGuard`/login so the front end actually obtains a token. The token
  must flow through `getSessionToken()` (see §5).
- Locked in by `tests/unit/auth.test.ts`.

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

## Known gaps (intentionally not fixed yet — don't "fix" silently)

1. **Light mode is not implemented.** The app is dark-only: the shell uses
   hardcoded dark classes (`bg-zinc-950`, `text-zinc-100`) with almost no
   `dark:` variants. The light/dark toggle (`settings.darkMode` →
   `documentElement.classList` in `App.tsx`) therefore does almost nothing.
   Building real light mode is a large, app-wide effort. **Decision: leave as-is
   for now.** Either remove the toggle or do a full themed-colour pass — but only
   as an explicit, scoped task.
2. **SSL filter dropdown has no "Unknown" option** (`FilterBar.tsx`), so
   domains with unknown SSL can't be isolated via that filter.

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

`ssl`, `dns`, `whois`, `gmb`, `tech-detect` each have a Vercel function
(`api/*.ts`) AND a dev proxy route (`server/proxy.ts`). The actual lookup logic
lives ONCE in `api/_utils/{sslLookup,dnsLookup,whoisLookup,gmbLookup,techLookup}.ts`.
Both sides import it. **Never** reimplement a lookup inline in an endpoint or
the proxy — extend the shared util so prod and dev can't diverge. The proxy
must serve every `/api/*` route the frontend services call
(`check, ssl, dns, whois, gmb, tech-detect`) or that feature breaks in dev.

All outbound-fetching utils (`check`, `tech-detect`) go through the SSRF guard
(`validateOutboundUrlResolved` / `safeHeadRequest`). Keep it that way.

## Observability is additive — never changes response contracts

The API layer has a structured-logging + error-taxonomy stack
(`api/_utils/logger.ts`, `api/_utils/errors.ts`, `api/_utils/observability.ts`),
documented in `docs/logging-and-errors.md`. Rules:
- Each endpoint is wrapped with `withObservability('<op>', handler)`. The
  wrapper is **additive**: it adds an `x-request-id` header + start/finish logs
  and funnels only **uncaught** throws through the error taxonomy. It must
  **never** change a handler's existing status codes or response bodies.
- The enrichment endpoints (`ssl`/`dns`/`whois`/`tech-detect`) intentionally
  return `200` with an `{ error }` body on lookup failure so a failed
  enrichment can't downgrade liveness (§1/§6). Do **not** "fix" this into a 4xx/5xx.
- `logger.ts` must never throw and must redact secrets/PII — keep the
  `redact()` guards (secret-key patterns, email masking, circular/depth limits).
- Logs go to `stdout`/`stderr` as JSON, not `console.*` (the `no-console` lint
  rule allows only `warn`/`error`). Keep the direct-stream sink.
- Locked in by `tests/unit/{logger,errors,observability}.test.ts`.

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
