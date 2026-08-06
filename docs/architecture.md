# Architecture

DomainPulse is two React apps built from one codebase, served by a thin API
layer that is a set of Vercel serverless functions in production and an Express
proxy in local development.

## High-level components

| Layer | Where | Responsibility |
|-------|-------|----------------|
| Dashboard SPA | `index.html` / `App.tsx` (port 3000) | Domain monitoring UI |
| Marketing site | `site.html` / `SiteApp.tsx` (port 3002) | Public marketing pages |
| API (prod) | `api/*.ts` (Vercel functions) | Uptime/SSL/DNS/WHOIS/GMB/tech-detect + login |
| API (dev) | `server/proxy.ts` (Express, port 3001) | Same routes for local dev |
| Shared lookups | `api/_utils/*Lookup.ts` | One implementation per enrichment, used by both prod + dev |
| Cross-cutting utils | `api/_utils/{ssrfGuard,auth,rateLimit,logger,errors,observability}.ts` | Security, auth, rate limiting, observability |

In dev, Vite proxies `/api/*` from the dashboard (3000) to the Express proxy
(3001). In prod, `vercel.json` rewrites `/api/*` to the serverless functions.

## Request pipeline (monitoring)

1. **Normalize & queue** — the UI validates/normalizes a domain and queues it
   (main thread or the monitoring Web Worker).
2. **Liveness first** — `/api/check` performs an SSRF-guarded `HEAD` probe and
   sets the ALIVE/DOWN status, HTTP code, and latency. **This is the only signal
   that decides liveness** (see `AGENTS.md` §1).
3. **Enrichment (parallel, best-effort)** — `/api/ssl`, `/api/whois`,
   `/api/dns`, `/api/gmb`, `/api/tech-detect` run under `Promise.allSettled`;
   a failure degrades to a safe default and never flips liveness to Error.
4. **Persist & visualize** — results merge into the dashboard and `localStorage`.
5. **Notify** — status transitions can fire browser/Slack/Discord/sound alerts.

## Cross-cutting concerns

- **Security / SSRF** — all outbound fetches go through `api/_utils/ssrfGuard.ts`
  (`validateOutboundUrlResolved` / `safeHeadRequest` / `probeUptime`).
- **Auth** — opt-in (`api/_utils/auth.ts`): public when `VITE_PASSWORD_HASH` is
  unset, enforced when it is set (`AGENTS.md` §7).
- **Rate limiting** — `api/_utils/rateLimit.ts` (in-memory; KV-ready).
- **Observability** — `api/_utils/logger.ts` (structured JSON) +
  `api/_utils/errors.ts` (error taxonomy) + `api/_utils/observability.ts`
  (`withObservability` request wrapper). See [logging-and-errors.md](./logging-and-errors.md).

## Key invariants

The behavioral invariants that must not regress (liveness vs enrichment, the
`isReachableStatus` contract, the single-source `toCheckResult` mapping, status
badge text rules, auth opt-in, token storage) live in `AGENTS.md`. Read it
before changing monitoring, status, theming, filter, or API code.
