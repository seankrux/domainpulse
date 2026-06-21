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

Locked in by `tests/unit/ssrf.test.ts → "isReachableStatus (liveness contract)"`.

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

---

## Known gaps (intentionally not fixed yet — don't "fix" silently)

1. **Light mode is not implemented.** The app is dark-only: the shell uses
   hardcoded dark classes (`bg-zinc-950`, `text-zinc-100`) with almost no
   `dark:` variants. The light/dark toggle (`settings.darkMode` →
   `documentElement.classList` in `App.tsx`) therefore does almost nothing.
   Building real light mode is a large, app-wide effort. **Decision: leave as-is
   for now.** Either remove the toggle or do a full themed-colour pass — but only
   as an explicit, scoped task.
2. **Unresolvable domains return `400 Blocked "Host did not resolve"`** rather
   than a clean `DOWN`. The SSRF DNS check can't distinguish "private IP" from
   "doesn't resolve". A genuinely-dead domain currently surfaces as an endpoint
   error → `Error` status. Acceptable for now; revisit if false "Error" reports
   appear for dead domains.
3. **SSL filter dropdown has no "Unknown" option** (`FilterBar.tsx`), so
   domains with unknown SSL can't be isolated via that filter.

---

## Fix log (2026-06-21/22)

- `ssrfGuard.ts`: added `isReachableStatus` (up = status < 500) + `GET`
  fallback on 405/501. Fixes false-offline for amazon.com and HEAD-rejecting sites.
- `domainService.ts`: enrichment moved to `Promise.allSettled` so a failed
  SSL/DNS/WHOIS/tech call no longer downgrades an alive domain to Error.
- `StatusBadge.tsx`: HTTP code shown only for Alive/Down (kills amber "200 OK").
- `App.tsx`: sort order lookups use `??` instead of `||` (zero-index bug).
- `tests/unit/ssrf.test.ts`: liveness contract tests added.
