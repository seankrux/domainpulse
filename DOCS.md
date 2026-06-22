# DomainPulse — Developer Documentation

> **Audience:** Developers extending, deploying, or contributing to DomainPulse.
> Covers API reference, architecture, core modules, and the future development roadmap.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Data Model](#2-data-model)
3. [API Reference](#3-api-reference)
   - [POST /api/login](#post-apilogin)
   - [GET /api/check](#get-apicheck)
   - [GET /api/ssl](#get-apissl)
   - [GET /api/dns](#get-apidns)
   - [GET /api/whois](#get-apiwhois)
   - [GET /api/gmb](#get-apigmb)
   - [GET /api/tech-detect](#get-apitech-detect)
4. [Core Modules](#4-core-modules)
   - [services/domainService.ts](#servicesdomain-service)
   - [services/dnsService.ts](#servicesdns-service)
   - [services/sslService.ts](#servicesssl-service)
   - [services/expiryService.ts](#servicesexpiry-service)
   - [services/gmbService.ts](#servicesgmb-service)
   - [services/techDetectionService.ts](#servicestech-detection-service)
   - [services/monitoring.worker.ts](#servicesmonitoring-worker)
   - [hooks/useMonitoring.ts](#hooksusemonitoring)
   - [utils/authSession.ts](#utilsauthsession)
   - [utils/storage.ts](#utilsstorage)
   - [utils/csvHelper.ts](#utilscsvhelper)
   - [lib/config.ts](#libconfig)
5. [API Utilities](#5-api-utilities)
   - [api/_utils/ssrfGuard.ts](#ssrfguard)
   - [api/_utils/auth.ts](#auth)
   - [api/_utils/rateLimit.ts](#ratelimit)
   - [api/_utils/dnsLookup.ts](#dnslookup)
   - [api/_utils/sslLookup.ts](#ssllookup)
   - [api/_utils/whoisLookup.ts](#whoislookup)
   - [api/_utils/gmbLookup.ts](#gmblookup)
   - [api/_utils/techLookup.ts](#techlookup)
6. [Invariants & Guardrails](#6-invariants--guardrails)
7. [Authentication](#7-authentication)
8. [Environment Variables](#8-environment-variables)
9. [Local Development](#9-local-development)
10. [Testing](#10-testing)
11. [Future Development Roadmap](#11-future-development-roadmap)

---

## 1. Architecture Overview

DomainPulse is a React 19 + TypeScript SPA that runs two apps from a single codebase and routes all domain intelligence through a unified authenticated API layer.

```
┌─────────────────────────────────────────────────────┐
│                     Browser                         │
│                                                     │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │  Dashboard App   │    │   Marketing Site App  │  │
│  │  App.tsx         │    │   SiteApp.tsx         │  │
│  │  port 3000       │    │   port 3002           │  │
│  └────────┬─────────┘    └───────────────────────┘  │
│           │                                         │
│  ┌────────▼──────────────────────────────────────┐  │
│  │            useMonitoring hook                 │  │
│  │   Web Worker  ◄──────────── monitoring.worker │  │
│  └────────┬──────────────────────────────────────┘  │
└───────────┼─────────────────────────────────────────┘
            │  /api/* requests
            ▼
┌───────────────────────────────────┐
│  LOCAL DEV         PRODUCTION     │
│  Express proxy     Vercel fns     │
│  port 3001         /api/*.ts      │
└───────────┬───────────────────────┘
            │
            ▼
┌───────────────────────────────────┐
│        api/_utils/ layer          │
│                                   │
│  ssrfGuard  auth  rateLimit       │
│  dnsLookup  sslLookup  whoisLookup│
│  gmbLookup  techLookup            │
└───────────────────────────────────┘
```

### Two-App Build

| App | Entry | Dev Port | Build Output |
|-----|-------|----------|--------------|
| Dashboard | `index.html` / `App.tsx` | 3000 | `dist/` |
| Marketing Site | `site.html` / `SiteApp.tsx` | 3002 | `dist-site/` |

`npm run dev:all` starts both the Vite dev server and the Express proxy concurrently.

### Request Flow

1. `useMonitoring` or `monitoring.worker` calls `checkDomainWithSSL` in `services/domainService.ts`.
2. `domainService` fires `/api/check` first (liveness probe), then fans out to `/api/ssl`, `/api/whois`, `/api/dns`, `/api/tech-detect` in parallel.
3. Each Vercel serverless function (prod) / Express route (dev) calls the matching `api/_utils/*.ts` lookup util — the single implementation shared by both environments.
4. Results are merged into the domain record, appended to `history[]`, and persisted to `localStorage`.
5. Status transitions trigger webhooks (Slack/Discord) and/or browser notifications.

---

## 2. Data Model

All types live in [`types.ts`](types.ts).

### Domain

The root record for every tracked domain.

```ts
interface Domain {
  id: string;                  // UUID, generated on add
  url: string;                 // Clean domain, no protocol (e.g. "google.com")
  status: DomainStatus;        // ALIVE | DOWN | ERROR | UNKNOWN | CHECKING
  statusCode?: number;         // Last HTTP status code
  latency?: number;            // Last check latency in ms
  lastChecked?: Date;
  addedAt: Date;
  history: StatusRecord[];     // Up to 100 records (configurable)
  ssl?: SSLInfo;
  expiry?: DomainExpiry;       // WHOIS-derived expiration data
  dns?: DNSInfo;
  techStack?: TechStackInfo;
  gmb?: GmbInfo;               // Google Business Profile snapshot
  gmbPlaceId?: string;         // Optional: set to enable GMB checks
  groupId?: string;
  tags: string[];
  formCheck?: { status: FormCheckStatus; lastRun?: Date; results: FormResult[] };
  callCheck?: { status: CallCheckStatus; lastRun?: Date; results: CallButtonResult[] };
}
```

### DomainStatus

```ts
enum DomainStatus {
  Unknown  = 'UNKNOWN',
  Checking = 'CHECKING',
  Alive    = 'ALIVE',
  Down     = 'DOWN',
  Error    = 'ERROR',
}
```

`Error` is only reachable when the liveness probe itself fails (auth, network, or timeout). SSL/DNS/WHOIS failures never change status — they fall back to safe defaults. See [Invariants §1](#6-invariants--guardrails).

### SSLInfo

```ts
interface SSLInfo {
  status: SSLStatus;           // VALID | EXPIRING | EXPIRED | INVALID | UNKNOWN
  issuer?: string;
  validFrom?: Date;
  validTo?: Date;
  daysUntilExpiry?: number;
}
```

`EXPIRING` fires when `daysUntilExpiry <= 30`.

### DomainExpiry

```ts
interface DomainExpiry {
  status: 'active' | 'expiring' | 'expired' | 'unknown';
  expiryDate?: Date;
  createdDate?: Date;
  updatedDate?: Date;
  registrar?: string;
  registrarUrl?: string;
  nameServers?: string[];
  dnssec?: string;
  daysUntilExpiry?: number;
  domainStatus?: string[];     // Raw WHOIS status codes
}
```

### DNSInfo

```ts
interface DNSInfo {
  a?: string[];                          // IPv4 addresses
  mx?: { exchange: string; priority: number }[];
  ns?: string[];                         // Nameservers
  txt?: string[][];                      // TXT records (each entry is an array of strings)
  cname?: string[];
  error?: string;
}
```

### TechStackInfo

```ts
interface TechStackInfo {
  cms?: string;
  framework?: string;
  ecommerce?: string;
  analytics?: string[];
  javascriptLibraries?: string[];
  server?: string;
  adminUrl?: string;
  confidence: 'high' | 'medium' | 'low';
}
```

### GmbInfo

```ts
interface GmbInfo {
  status: GmbStatus;           // OPERATIONAL | CLOSED | NOT_FOUND | ERROR | UNKNOWN
  placeId?: string;
  name?: string;
  rating?: number;             // 0–5
  reviewCount?: number;
  businessStatus?: string;     // Raw Google field
  openNow?: boolean;
  address?: string;
  phone?: string;
  website?: string;
  mapsUrl?: string;
  lastChecked?: Date;
  error?: string;
}
```

---

## 3. API Reference

All endpoints share these common behaviours:

- **Auth** — Requires `Authorization: Bearer <token>` when `VITE_PASSWORD_HASH` is configured. Unauthenticated in public/demo mode.
- **Rate limiting** — 100 requests / 60 s per IP. In-memory in dev; Vercel KV in production when `KV_URL` is set.
- **CORS** — `ALLOWED_ORIGINS` env var controls accepted origins. Development allows localhost.
- **Response format** — Always JSON.

---

### POST /api/login

Authenticate and receive a JWT session token.

**Request**

```json
{ "password": "your-password" }
```

**Response 200**

```json
{
  "token": "<jwt>",
  "expiresAt": 1720000000000
}
```

**Response 401**

```json
{ "error": "Invalid password" }
```

**Response 500**

```json
{ "error": "Authentication password hash not configured. Set VITE_PASSWORD_HASH environment variable." }
```

**Notes**

- Token lifetime is controlled by `VITE_AUTH_SESSION_TTL_MINUTES` (default 720 min / 12 h).
- The token is stored in `sessionStorage` under key `domainpulse_auth_session`.
- All subsequent requests must include `Authorization: Bearer <token>`.
- Bootstrap mode (`VITE_ALLOW_INITIAL_LOGIN=true`, non-production only) allows the first `POST /api/login` to set the password hash in-memory. Never use in production.

---

### GET /api/check

Liveness probe for a domain. Single source of truth for ALIVE/DOWN status.

**Query Parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `url` | Yes | Full URL or bare domain (e.g. `https://example.com` or `example.com`) |
| `ua` | No | Custom User-Agent string (default: `DomainPulse/1.0 (Domain Monitor)`) |
| `timeout` | No | Timeout in ms, capped at 30000 (default: 10000) |

**Response 200**

```json
{
  "status": "ALIVE",
  "statusCode": 200,
  "latency": 134
}
```

| Field | Type | Values |
|-------|------|--------|
| `status` | string | `"ALIVE"` \| `"DOWN"` |
| `statusCode` | number | HTTP status code from the probe (0 = no response) |
| `latency` | number | Round-trip time in ms |

**Liveness rule:** `statusCode > 0 && statusCode < 500` = ALIVE. 401, 403, 404, 405, 429 are all ALIVE. Only 5xx or 0 is DOWN. The HEAD → GET fallback fires on 405/501.

**Response 400**

```json
{ "error": "Blocked", "message": "Target host is not allowed (private/internal address)" }
```

Returned when the SSRF guard rejects the URL (private IP, internal hostname, etc.).

---

### GET /api/ssl

SSL certificate inspection for a domain.

**Query Parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `domain` | Yes | Bare domain (e.g. `example.com`) |

**Response 200**

```json
{
  "valid": true,
  "issuer": "Let's Encrypt",
  "validFrom": "2024-01-01T00:00:00Z",
  "validTo": "2024-04-01T00:00:00Z",
  "daysUntilExpiry": 45
}
```

On failure:

```json
{ "valid": false, "error": "connect ECONNREFUSED" }
```

---

### GET /api/dns

Full DNS record lookup using public resolvers (8.8.8.8 / 1.1.1.1).

**Query Parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `domain` | Yes | Bare domain |

**Response 200**

```json
{
  "a": ["93.184.216.34"],
  "mx": [{ "exchange": "mail.example.com", "priority": 10 }],
  "ns": ["ns1.example.com", "ns2.example.com"],
  "txt": [["v=spf1 include:_spf.example.com ~all"]],
  "cname": []
}
```

All fields are always present and default to `[]` on lookup failure. No error field is returned — partial results are valid.

---

### GET /api/whois

WHOIS-based domain expiration and registrar metadata.

**Query Parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `domain` | Yes | Bare domain |

**Response 200**

```json
{
  "status": "active",
  "expiryDate": "2025-12-31T00:00:00Z",
  "createdDate": "2015-01-01T00:00:00Z",
  "updatedDate": "2024-01-01T00:00:00Z",
  "registrar": "Namecheap, Inc.",
  "registrarUrl": "https://www.namecheap.com",
  "nameServers": ["ns1.example.com"],
  "dnssec": "unsigned",
  "daysUntilExpiry": 180,
  "domainStatus": ["clientTransferProhibited"]
}
```

`status` values: `"active"` | `"expiring"` (≤ 30 days) | `"expired"` | `"unknown"`.

---

### GET /api/gmb

Google Business Profile lookup via the Places API.

**Query Parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `placeId` | One of these | Google Place ID (preferred — stable) |
| `query` | One of these | Free-text business name + locality |

Requires `GOOGLE_PLACES_API_KEY` env var. Without it, returns `status: "UNKNOWN"` with a descriptive error — the dashboard degrades gracefully.

**Response 200**

```json
{
  "status": "OPERATIONAL",
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "name": "Example Business",
  "rating": 4.5,
  "reviewCount": 123,
  "businessStatus": "OPERATIONAL",
  "openNow": true,
  "address": "123 Main St, Sydney NSW",
  "phone": "+61 2 1234 5678",
  "website": "https://example.com",
  "mapsUrl": "https://maps.google.com/?cid=...",
  "lastChecked": "2026-06-22T00:00:00Z"
}
```

`status` values: `"OPERATIONAL"` | `"CLOSED"` | `"NOT_FOUND"` | `"ERROR"` | `"UNKNOWN"`.

---

### GET /api/tech-detect

Tech stack detection via header and HTML fingerprinting.

**Query Parameters**

| Param | Required | Description |
|-------|----------|-------------|
| `url` | Yes | Full URL or bare domain |

**Response 200**

```json
{
  "cms": "WordPress",
  "framework": null,
  "ecommerce": "WooCommerce",
  "analytics": ["Google Analytics", "Meta Pixel"],
  "javascriptLibraries": ["jQuery"],
  "server": "nginx",
  "adminUrl": "https://example.com/wp-admin",
  "confidence": "high"
}
```

`confidence` values: `"high"` | `"medium"` | `"low"`. A result with `confidence: "low"` is excluded from the domain record in the UI.

---

## 4. Core Modules

### services/domainService.ts

Central orchestrator for all domain checks.

**`validateAndNormalizeUrl(input)`**

Validates user-supplied input and returns a clean bare domain. Rejects dangerous patterns (`javascript:`, `data:`, `..`, `%00`, etc.) and invalid domain formats.

```ts
validateAndNormalizeUrl('https://GOOGLE.COM/path?q=1')
// → { valid: true, url: 'google.com' }

validateAndNormalizeUrl('javascript:alert(1)')
// → { valid: false, error: 'Invalid URL format' }
```

**`checkDomainWithSSL(url, serviceConfig?)`**

Runs the full two-phase check:

1. **Phase 1 — liveness** (hard timeout guards this only): calls `/api/check` via Vercel function then local proxy fallback.
2. **Phase 2 — enrichment** (soft timeout, never throws): calls SSL, WHOIS, DNS, tech-detect in `Promise.allSettled`. Each failure falls back to a safe default. Enrichment can never change the ALIVE/DOWN result.

```ts
const result = await checkDomainWithSSL('example.com', {
  authToken: 'jwt...',
  timeout: 15000,
  proxyUrl: 'http://localhost:3001',
});
// result.status, result.ssl, result.expiry, result.dns, result.techStack
```

---

### services/dnsService.ts

**`checkDNS(domain, config?)`**

Fetches DNS records from `/api/dns`. Falls through to the local proxy on failure.

```ts
const dns = await checkDNS('example.com');
// dns.a, dns.mx, dns.ns, dns.txt, dns.cname
```

---

### services/sslService.ts

**`checkSSL(url, config?)`**

Fetches SSL info from `/api/ssl`. Returns `{ status: SSLStatus.Unknown }` on any failure — never throws.

---

### services/expiryService.ts

**`checkDomainExpiry(url, config?)`**

Fetches WHOIS expiry from `/api/whois`. Returns `{ status: 'unknown' }` on failure.

---

### services/gmbService.ts

**`checkGmb(domain, placeId?, config?)`**

GMB lookup. Skipped entirely if no `placeId` is configured on the domain and no `GOOGLE_PLACES_API_KEY` exists. Returns `{ status: GmbStatus.Unknown }` on failure.

---

### services/techDetectionService.ts

**`detectTechStack(url, config?)`**

Calls `/api/tech-detect`. Returns `{ confidence: 'low' }` on failure (excluded from domain record).

---

### services/monitoring.worker.ts

Web Worker that receives a batch of domains + a `ServiceConfig`, calls `checkDomainWithSSL` for each, and posts results back to the main thread. Runs off the main thread so the UI stays responsive during bulk checks.

The auth token **must** be read on the main thread (Workers have no `sessionStorage`) and passed in via `ServiceConfig.authToken`.

---

### hooks/useMonitoring.ts

React hook wiring the Web Worker to domain state. Exposes:

- `checkAll()` — fans out a check for all domains via the worker.
- `checkSingleDomain(domain)` — re-checks one domain directly (no worker).
- `isCheckingAll` — boolean loading state.
- `checkProgress` — `{ current, total }` for the progress bar.

**Token contract:** Both `checkBatch` and `checkSingleDomain` must read the auth token via `getSessionToken()` and pass it as `ServiceConfig.authToken`. The worker cannot read `sessionStorage`.

---

### utils/authSession.ts

**Single source of truth for the client-side auth token.**

```ts
import { getSessionToken, setSessionToken, clearSessionToken } from './utils/authSession';

getSessionToken()      // reads from sessionStorage — only call this function
setSessionToken(jwt)   // called by AuthProvider on login
clearSessionToken()    // called on logout
```

Do not call `sessionStorage.getItem('domainpulse_auth_session')` anywhere else. See [Invariant §5](#6-invariants--guardrails).

---

### utils/storage.ts

`localStorage`-backed persistence for domain records, settings, and groups. All reads/writes go through typed helpers here — never read `localStorage` directly in components.

---

### utils/csvHelper.ts

CSV import (`parseCsvDomains`) and export (`exportDomainsToCSV`) helpers. Import accepts a header row with optional `group`, `tags`, and `gmbPlaceId` columns.

---

### lib/config.ts

Centralized constants. All timeouts, limits, and defaults are defined here.

```ts
config.timeouts.domainCheck    // 15000 ms
config.timeouts.sslCheck       // 10000 ms
config.rateLimit.maxRequests   // 100 req/min
config.monitoring.maxHistoryRecords  // 100
config.ssl.expiringThresholdDays     // 30
config.domain.maxDomains             // 1000
```

---

## 5. API Utilities

### ssrfGuard

`api/_utils/ssrfGuard.ts` — shared by all outbound-fetching endpoints.

| Export | Description |
|--------|-------------|
| `isBlockedIp(ip)` | Returns true for loopback, RFC1918, CGNAT, link-local, IPv6 ULA |
| `isBlockedHost(hostname)` | Sync literal reject — fast first pass |
| `validateOutboundUrl(raw)` | Sync URL + scheme + literal host check |
| `validateOutboundUrlResolved(raw)` | Async: adds DNS resolution check (DNS rebinding protection) |
| `isReachableStatus(status)` | `status > 0 && status < 500` — the liveness contract |
| `toCheckResult(r)` | Maps `SafeHeadResult` → `CheckResult` shape. **Single source of truth** for ALIVE/DOWN mapping — both `api/check.ts` and `server/proxy.ts` must use this, never hand-roll the mapping |
| `safeHeadRequest(url, opts)` | SSRF-safe HEAD probe. Follows redirects, validates each hop, GET fallback on 405/501 |

---

### auth

`api/_utils/auth.ts`

| Export | Description |
|--------|-------------|
| `verifyAuth(req)` | Returns true if auth disabled (no `VITE_PASSWORD_HASH`) or Bearer token is valid JWT |
| `generateToken()` | Returns `{ token, expiresAt }`. Uses `JWT_SECRET` (prod) or a per-process random key (dev) |
| `getCorsHeaders(origin)` | Returns CORS headers. Strict allow-list in prod, localhost-permissive in dev |
| `isAuthBootstrapAllowed()` | True only in non-production with `VITE_ALLOW_INITIAL_LOGIN=true` |

---

### rateLimit

`api/_utils/rateLimit.ts`

| Export | Description |
|--------|-------------|
| `checkRateLimit(ip, config)` | Returns true if request is allowed. Uses Vercel KV when `KV_URL` set, in-memory otherwise |
| `getRateLimitHeaders(ip, config)` | Returns `X-RateLimit-*` headers |
| `clearRateLimit(ip)` | Test helper |
| `clearAllRateLimits()` | Test helper |

Default: 100 requests / 60 s per IP.

---

### dnsLookup

`api/_utils/dnsLookup.ts` — `getDNSInfo(domain)` queries A, MX, NS, TXT, CNAME via Node `dns.promises.Resolver` using `8.8.8.8` and `1.1.1.1`. All record types are `allSettled` — partial results are returned if some lookups fail.

---

### sslLookup

`api/_utils/sslLookup.ts` — connects via Node `tls` to inspect the certificate. Returns validity, issuer, dates, and days until expiry.

---

### whoisLookup

`api/_utils/whoisLookup.ts` — performs WHOIS queries and parses expiry, created, updated dates, registrar, nameservers, and DNSSEC status.

---

### gmbLookup

`api/_utils/gmbLookup.ts` — wraps the Google Places API. Accepts `placeId` (preferred) or `query` (resolves to Place ID first). Returns `GmbInfo`. Degrades to `{ status: UNKNOWN }` when `GOOGLE_PLACES_API_KEY` is not set.

---

### techLookup

`api/_utils/techLookup.ts` — fetches the target URL and inspects response headers (`X-Powered-By`, `Server`) and HTML content (meta generators, script paths, admin URLs) to fingerprint the tech stack.

---

## 6. Invariants & Guardrails

These rules exist because violating them has caused real production bugs. Read `AGENTS.md` for the full history.

### 1. Liveness is the only source of truth

`/api/check` decides ALIVE/DOWN. SSL, DNS, WHOIS, tech-detect are enrichment only.

- Enrichment runs via `Promise.allSettled`, never `Promise.all`.
- A failed enrichment falls back to `{ status: SSLStatus.Unknown }` / `{ status: 'unknown' }` / `undefined` / `{ confidence: 'low' }`.
- `Error` status is only reachable when the liveness probe itself fails.

### 2. Liveness threshold: `status > 0 && status < 500`

401, 403, 404, 405, 429 = ALIVE. Only 5xx or no response = DOWN. HEAD → GET retry on 405/501.

### 3. Status badge shows HTTP code only for ALIVE/DOWN

Never display `statusCode` when `status` is `Error`, `Unknown`, or `Checking` — a stale code renders misleadingly (e.g. amber "200 OK").

### 4. Sort comparators use `??`, not `||`

Order maps start at `0`. Use `sslOrder[x] ?? 4`, never `sslOrder[x] || 4` — `0 || fallback` incorrectly uses the fallback.

### 5. Auth token has one reader: `getSessionToken()`

`AuthProvider` writes to `sessionStorage`. All services must read via `getSessionToken()`. Never call `sessionStorage.getItem(...)` or `localStorage.getItem(...)` directly in services.

### 6. Timeout guards liveness only

Hard timeout wraps only `resolveLiveness()`. Enrichment uses `allSettled` + `raceToDefault` (resolves, never rejects). Do not wrap the whole `checkDomainWithSSL` in one rejecting timeout.

### 7. Auth is opt-in — public when no password configured

`verifyAuth` allows all requests when `VITE_PASSWORD_HASH` is unset. This matches the dev proxy and the `AuthGuard` stub. Setting `VITE_PASSWORD_HASH` enables enforcement on both ends.

### One implementation per lookup

Every lookup (`ssl`, `dns`, `whois`, `gmb`, `tech-detect`) lives once in `api/_utils/`. Both the Vercel function and the dev proxy import it. Never reimplement a lookup inline.

---

## 7. Authentication

### Public / Demo Mode (default)

No env vars needed. `verifyAuth` always returns true. No login UI shown.

### Protected Mode

1. Generate a PBKDF2 hash:
   ```bash
   node -e "
     const c = require('crypto');
     const salt = c.randomBytes(16).toString('hex');
     const hash = c.pbkdf2Sync('YOUR_PASSWORD', salt, 100000, 32, 'sha256').toString('hex');
     console.log(hash + ':' + salt);
   "
   ```
2. Set environment variables:
   ```
   VITE_PASSWORD_HASH=<hash:salt>
   JWT_SECRET=<openssl rand -hex 32>
   ```
3. Restore the real `AuthGuard` login flow (the current stub skips login).

### Session Lifecycle

| Event | Action |
|-------|--------|
| Login | `POST /api/login` → JWT stored in `sessionStorage` via `setSessionToken()` |
| Request | All service calls attach `Authorization: Bearer <token>` |
| Expiry | Token TTL = `VITE_AUTH_SESSION_TTL_MINUTES` (default 720 min) |
| Logout | `clearSessionToken()` clears `sessionStorage` |

---

## 8. Environment Variables

### Dashboard + API

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_PASSWORD_HASH` | No | — | PBKDF2 `hash:salt`. Enables auth. |
| `JWT_SECRET` | When auth on | — | JWT signing secret. Required in production when auth enabled. |
| `VITE_AUTH_SESSION_TTL_MINUTES` | No | 720 | JWT session lifetime in minutes |
| `VITE_ALLOW_INITIAL_LOGIN` | No | — | Set `true` to enable dev bootstrap (non-production only) |
| `ALLOWED_ORIGINS` | No | localhost | Comma-separated CORS origins |
| `GOOGLE_PLACES_API_KEY` | No | — | Enables GMB monitoring |
| `KV_URL` | No | — | Vercel KV URL for distributed rate limiting |
| `VITE_PROXY_URL` | No | `http://localhost:3001` | Local proxy base URL |

### Vercel Deployment Minimum

```
VITE_PASSWORD_HASH=<hash:salt>
JWT_SECRET=<random-hex>
ALLOWED_ORIGINS=https://yourdomain.vercel.app
```

---

## 9. Local Development

### Setup

```bash
npm install
```

### Run Dashboard + Proxy

```bash
npm run dev:all
# Dashboard → http://localhost:3000
# Proxy API → http://localhost:3001
```

### Run Marketing Site

```bash
npm run dev
# Site → http://localhost:3002
```

### Build Both Apps

```bash
npm run build:all
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Dashboard (port 3000) + Express proxy (port 3001) |
| `npm run dev` | Marketing site (port 3002) |
| `npm run build:all` | Production build for both apps |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript type checking |
| `npm run test` | Vitest unit tests |
| `npm run test:gui` | Playwright E2E tests |

### Proxy Routes

The Express proxy at `server/proxy.ts` mirrors every `/api/*` route the frontend uses. All lookup logic is imported from `api/_utils/` — the proxy shares the same implementation as the Vercel functions.

---

## 10. Testing

### Unit Tests (Vitest)

```bash
npm run test
```

Key test files:

| File | What it covers |
|------|---------------|
| `tests/unit/ssrf.test.ts` | `isReachableStatus` liveness contract, `toCheckResult` mapping, blocked hosts/IPs |
| `tests/unit/auth.test.ts` | Auth opt-in behaviour, public mode, JWT verify |
| `tests/unit/authSession.test.ts` | `getSessionToken` single reader contract |
| `tests/unit/checkDomainWithSSL.test.ts` | Liveness invariant, enrichment fallback, hang/timeout |
| `tests/unit/sslService.test.ts` | SSL status parsing |
| `tests/unit/storage.test.ts` | localStorage persistence |
| `tests/unit/csvHelper.test.ts` | CSV import/export |
| `tests/unit/domainService.test.ts` | URL validation |
| `tests/unit/gmb.test.ts` | GMB lookup and degradation |

### E2E Tests (Playwright)

```bash
npm run test:gui
```

Tests cover the dashboard UI, settings panel, filter/sort, bulk import, and button interactions.

### QA Engine Tests

Form submission and call-button swap detection tests:

```bash
# Run from tests/qa/ with Playwright QA config
npx playwright test --config tests/qa/playwright.qa.config.ts
```

---

## 11. Future Development Roadmap

The features below extend DomainPulse's existing DNS, domain, and monitoring infrastructure. They are grouped by implementation complexity and the value they deliver.

---

### Tier 1 — Zero New APIs (reuse existing data)

These features require no new external API integrations and can be built entirely against data already fetched.

#### 1.1 DMARC / SPF / DKIM Parser

TXT records are already fetched by `/api/dns`. Parse them to surface email authentication status.

- Parse `v=spf1 …` → SPF pass/warn/fail badge.
- Parse `v=DMARC1 …` → DMARC policy badge (none / quarantine / reject).
- Detect DKIM selector TXT records (e.g. `k._domainkey`).
- Add `emailAuth` field to `DNSInfo` and `Domain` types.
- Surface a combined "Email Deliverability" badge in the domain table.

**New type:**
```ts
interface EmailAuthInfo {
  spf: 'pass' | 'softfail' | 'fail' | 'missing';
  dmarc: 'reject' | 'quarantine' | 'none' | 'missing';
  dkimSelectors: string[];
}
```

#### 1.2 DNS Change Detection / Alert

Diff current DNS snapshot against the previous one stored in the domain record. Fire a webhook alert when any A, MX, NS, or TXT record changes.

- Store `dns` as the "last known" snapshot (already in `Domain.dns`).
- After each check, diff incoming `DNSInfo` against `domain.dns`.
- If changed: add a `DomainStatus.DnsChanged` event to `history` and fire the configured webhooks.
- Add a "DNS last changed" timestamp to the domain detail modal.

#### 1.3 HTTP Security Headers Audit

Single additional fetch against the domain — inspect response headers and grade them A–F.

Headers to check: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

- New `api/headers.ts` endpoint and `api/_utils/headersLookup.ts`.
- New `SecurityHeadersInfo` type with per-header pass/fail and overall grade.
- Surface as a "Headers" badge in the domain table and a breakdown panel in the detail modal.

---

### Tier 2 — Free APIs (no paid key required)

#### 2.1 Spam / Blacklist Check

Query public DNS-based block lists to check if the domain or its A-record IP appears.

Lists to query: Spamhaus ZEN (`zen.spamhaus.org`), Barracuda (`b.barracudacentral.org`), SORBS (`dnsbl.sorbs.net`).

- New `api/blacklist.ts` endpoint; lookup is a DNS TXT query against each DNSBL.
- Result: `{ listed: boolean; listCount: number; lists: string[] }`.
- Surface as a "Blacklist" badge — red if listed, green if clean.
- `GOOGLE_SAFE_BROWSING_API_KEY` (free key) can extend this with Google Safe Browsing malware/phishing detection.

#### 2.2 SSL Protocol / Cipher Grade

Extend the existing `/api/ssl` to report TLS protocol version and cipher suite.

- Already connecting via Node `tls` — add `secureProtocol` and `getCipher()` to the response.
- Grade: TLS 1.3 = A, TLS 1.2 = B, TLS 1.0/1.1 = F.
- Add `protocol` and `cipherSuite` fields to `SSLInfo`.
- Surface as part of the SSL badge tooltip / detail modal.

#### 2.3 Subdomain Discovery (crt.sh)

Query certificate transparency logs for known subdomains.

- `GET https://crt.sh/?q=%.example.com&output=json` — free, no key.
- New `api/subdomains.ts` endpoint.
- New `SubdomainInfo` type with `discovered: string[]`.
- Surface as a collapsible "Subdomains" panel in the domain detail modal.
- Optionally add discovered subdomains as child domains in the dashboard.

#### 2.4 Core Web Vitals / PageSpeed

Google PageSpeed Insights API is free for 25,000 queries/day without a key.

- `GET https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=…&strategy=mobile`
- New `api/pagespeed.ts` endpoint.
- New `PageSpeedInfo` type: `{ lcp, cls, fid, fcp, ttfb, score }`.
- Surface as a "Performance" badge (green ≥ 90, yellow ≥ 50, red < 50).

---

### Tier 3 — Paid APIs (require external key)

#### 3.1 Domain Authority / DR Score

Integrate a third-party SEO authority API to show domain strength.

- Options: Moz Link Explorer API, Ahrefs API, SEMrush API, or free alternative OpenPageRank.
- New `AUTHORITY_API_KEY` and `AUTHORITY_PROVIDER` env vars.
- New `api/authority.ts` endpoint.
- New `AuthorityInfo` type: `{ score: number; backlinks: number; referringDomains: number; provider: string }`.
- Surface as a "DA" / "DR" badge with historical trend.

#### 3.2 Backlink Count

Companion to domain authority — referring domain count over time.

- Most authority APIs return backlink count in the same response; split the existing `AuthorityInfo` type if needed.
- Store as part of domain enrichment, trend in history.

#### 3.3 Page Indexing Status

Check how many pages Google has indexed for the domain.

- Options: SerpAPI `site:` query, Google Search Console API (per-user OAuth).
- New `api/indexing.ts` endpoint.
- New `IndexingInfo` type: `{ indexedPages: number; lastCrawled?: Date }`.
- Alert on sudden de-indexing (> 20% drop).

---

### Tier 4 — Infrastructure / UX

#### 4.1 DNS Propagation Checker

Query the same domain across 10+ geographically distributed resolvers simultaneously.

- Resolvers: Cloudflare (1.1.1.1), Google (8.8.8.8), OpenDNS (208.67.222.222), Quad9 (9.9.9.9), regional ISP resolvers.
- Extend `api/dns.ts` to accept a `?propagation=true` param.
- Return a per-resolver result map: `{ resolver: string; result: string[]; matched: boolean }[]`.
- Surface as a "Propagation" modal showing a world-map-style grid.

#### 4.2 Scheduled Check Intervals Per Domain

Allow per-domain check cadence instead of the global refresh interval.

- Add `checkIntervalMs?: number` to the `Domain` type.
- `useMonitoring` respects per-domain interval when set, falls back to global.
- UI: interval picker in the domain detail modal / edit drawer.

#### 4.3 Incident Timeline

Structured incident view: when the domain went DOWN, how long, when it recovered.

- Derive from `domain.history[]` by grouping consecutive DOWN records into incidents.
- New `Incident` computed type: `{ start: Date; end?: Date; durationMs: number; statusCode: number }`.
- Surface as a collapsible "Incidents" panel in the domain detail modal.
- Exportable via CSV.

#### 4.4 SLA / Uptime Calculator

Compute rolling uptime percentage and alert when SLA threshold is breached.

- Derive from `domain.history[]`.
- Configurable threshold: 99.9%, 99.5%, 99%.
- Add `slaThreshold?: number` to domain settings.
- Surface a monthly uptime % badge and alert webhook on breach.

#### 4.5 Multi-Region Probes

Check from EU, US, and APAC simultaneously to distinguish regional outages from global ones.

- Vercel Edge Functions are the natural fit — deploy the probe logic as an Edge function at multiple regions.
- Add `region: 'us-east' | 'eu-west' | 'ap-southeast'` to `StatusRecord`.
- Surface per-region status in the history chart.

#### 4.6 Screenshot on Status Change

Capture a viewport screenshot when a domain transitions to DOWN.

- Use Vercel's Puppeteer or Playwright browser integration.
- Store screenshot URL in `StatusRecord.screenshotUrl`.
- Surface in the incident timeline and detail modal.

#### 4.7 Public Status Page

`/status/[slug]` route showing uptime for a domain group — shareable with clients without requiring login.

- New `SiteApp` route (already has the site Vite config).
- Read domain group from a public-facing API endpoint with no auth required.
- Configurable: which groups to expose, what fields to show.

#### 4.8 API Key Management UI

Settings panel for managing third-party API keys (currently only GMB is supported as an env var).

- New `Settings.apiKeys` section in the settings panel.
- Keys stored encrypted in `localStorage` (or Vercel KV for multi-device).
- Covers: Google Places, PageSpeed, Moz/Ahrefs, Safe Browsing, SerpAPI.
- Toggle per key — features that require missing keys degrade gracefully (same pattern as GMB).

#### 4.9 PagerDuty / OpsGenie Alert Routing

Extend the existing webhook system beyond Slack/Discord.

- Add `type: 'pagerduty' | 'opsgenie'` to `WebhookConfig`.
- Implement the PagerDuty Events API v2 and OpsGenie Alert API in `services/notificationService.ts`.

#### 4.10 Light Mode

Currently dark-only. The toggle in settings does almost nothing (see `AGENTS.md` Known Gaps §1).

- Full themed-colour pass replacing hardcoded `bg-zinc-950` / `text-zinc-100` classes with CSS variables or `dark:` variants.
- `theme/statusColors.ts` already exists as the single source for status colours — extend it with light-mode values.

---

### Implementation Priority

| Priority | Feature | Effort | Value |
|----------|---------|--------|-------|
| 🔥 High | DMARC/SPF parser (1.1) | Low — reuses TXT data | High for email clients |
| 🔥 High | DNS change detection (1.2) | Low | High operational value |
| 🔥 High | HTTP security headers (1.3) | Low | High for security audits |
| 🔥 High | Blacklist check (2.1) | Low | High for email deliverability |
| 🟡 Medium | SSL protocol grade (2.2) | Low | Medium |
| 🟡 Medium | Incident timeline (4.3) | Medium | High |
| 🟡 Medium | Core Web Vitals (2.4) | Low | High |
| 🟡 Medium | Subdomain discovery (2.3) | Low | Medium |
| 🟢 Lower | Domain authority (3.1) | Medium (paid API) | High for SEO clients |
| 🟢 Lower | Multi-region probes (4.5) | High | High for uptime SLAs |
| 🟢 Lower | Public status page (4.7) | Medium | High for client-facing |
| 🟢 Lower | Light mode (4.10) | High | Medium |

---

*Last updated: 2026-06-22. For invariants and bug-fix history, see [`AGENTS.md`](AGENTS.md).*
