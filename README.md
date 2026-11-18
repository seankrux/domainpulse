<div align="center">
  <h1>DomainPulse <sup>v1.0</sup></h1>
  <p>Real-time domain monitoring dashboard for uptime, SSL, DNS, and expiry tracking</p>

  <p>
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  </p>

  <br><br>

  <a href="https://seankrux-domainpulse.seanllms.workers.dev/app"><strong>Live Demo &rarr;</strong></a>

  [Cloudflare deployment workflow](https://github.com/seankrux/domainpulse/actions/workflows/cloudflare.yml)
</div>

---

## Overview

Full-featured domain monitoring dashboard that tracks uptime, SSL certificate status, DNS records, and domain expiration dates. Supports browser notifications, Slack/Discord webhooks, Web Audio alerts, and bulk CSV import/export. Runs two React apps from a single codebase — the dashboard and a marketing site.

<br>

## Why DomainPulse?

> **Unified monitoring surface** — DomainPulse is a modern React SPA that brings uptime, DNS, WHOIS, and SSL monitoring into one workflow instead of splitting critical domain intelligence across separate tools.

> **Built for fast operational signal** — Checks run in the background, historical status is retained locally, and alerts can reach the browser, Slack, Discord, and Web Audio channels without adding heavy infrastructure.

> **Productized beyond a demo** — Ships with a protected dashboard, bulk domain management, a dedicated marketing site, and a deployment-ready serverless API layer from a single codebase.

<br>

## Features

> **Uptime Monitoring** — Latency tracking with history charts

> **SSL Tracking** — Certificate status and expiry alerts

> **Domain Expiry** — WHOIS-based expiration tracking

> **DNS Lookup** — Full DNS record inspection

> **Groups and Tags** — Organize domains into logical groups

> **Notifications** — Browser, Slack, and Discord webhook support

> **Sound Alerts** — Web Audio API notifications

> **CSV Import/Export** — Bulk domain management

> **Password Auth** — PBKDF2 + salt authentication

> **Web Worker** — Non-blocking background monitoring

<br>

## How It Works

DomainPulse routes domain checks through a single API surface with optional server-side password protection: Cloudflare Workers in production and an Express proxy during local development. Each monitoring pass follows a layered pipeline so the UI stays responsive while the app collects richer domain intelligence.

1. **Normalize and queue domains** — User input is validated, normalized to a clean domain, and queued for checking by the monitoring hook or Web Worker batch runner.
2. **Measure uptime first** — `/api/check` performs a fast `HEAD` request against the target domain to determine availability, status code, and latency.
3. **Enrich results in parallel** — After uptime succeeds, DomainPulse concurrently calls `/api/ssl`, `/api/whois`, and `/api/dns` to gather certificate validity, expiration metadata, registrar details, and live DNS records.
4. **Persist and visualize state** — Results are merged into the dashboard, appended to each domain's history, and stored in `localStorage` so operators keep context across sessions.
5. **Notify on meaningful changes** — Status transitions can trigger browser notifications, Slack or Discord webhooks, and optional sound alerts for immediate operator feedback.

<br>

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| UI | React 19, TypeScript, Tailwind CSS v4 | Modern SPA interface for the dashboard and marketing site |
| Build & Dev Workflow | Vite 6, TSX, Concurrently | Fast local iteration, dual-app development, and production builds |
| Data Visualization | Recharts | Latency and status history charts |
| Icons & UI Assets | Lucide React | Lightweight iconography across the product |
| Monitoring Engine | Web Workers, Fetch API, Web Audio API | Background checks, responsive UI updates, and audible alerts |
| API Layer | Express (dev proxy), Cloudflare Workers (prod) | Unified monitoring endpoints for uptime, DNS, WHOIS, and SSL checks |
| Network & Domain Intelligence | Public-only edge Fetch, DNS-over-HTTPS, protected Node TLS origin | Certificate inspection, DNS resolution, and domain reachability checks |
| Authentication & Security | PBKDF2, JWT, CORS controls, rate limiting | Password protection and guarded API access |
| Client Persistence | `localStorage`, `sessionStorage` | Domain lists, settings, history, and authenticated session state |
| Testing & Quality | Vitest, Testing Library, Playwright, ESLint | Unit coverage, UI verification, end-to-end tests, and code quality checks |
| Deployment | Personal Cloudflare Workers + static assets | Marketing, dashboard and all API routes; protected Tokyo TLS helper |

<br>

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Run Locally

Use the commands below to run the full monitoring dashboard with the local proxy server, or launch the standalone marketing site.

```bash
# Run dashboard + proxy server
npm run dev:all
# Open http://localhost:3000

# Run the marketing site
npm run dev
# Open http://localhost:3002
```

### Recommended Local Workflow

1. Install dependencies with `npm install`.
2. Start the dashboard and proxy server with `npm run dev:all`.
3. Open `http://localhost:3000` to use the monitoring dashboard.
4. Run `npm run dev` in a separate session when you want to preview the marketing site on `http://localhost:3002`.
5. Build both apps for production with `npm run build:all`.

### Authentication Setup

Create `.env.local`:

```bash
VITE_PASSWORD_HASH=<your-pbkdf2-hash:salt>
```

Generate a hash:

```bash
node -e "const crypto = require('crypto'); const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.pbkdf2Sync('your-password', salt, 100000, 32, 'sha256').toString('hex'); console.log(hash + ':' + salt);"
```

<br>

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Dashboard + proxy server |
| `npm run dev` | Marketing site only |
| `npm run build:all` | Build both apps |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript type checking |
| `npm run test` | Vitest unit tests |
| `npm run test:gui` | Playwright E2E tests |

<br>

## Architecture

Two React apps built from a single codebase:

| App | Entry | Port |
|-----|-------|------|
| DomainPulse | `index.html` / `App.tsx` | 3000 |
| Marketing Site | `site.html` / `SiteApp.tsx` | 3002 |

> **Local dev** — Vite proxies `/api/*` to Express on port 3001

> **Production** — Personal Cloudflare Worker: `/` is the marketing site, `/app` is the monitoring dashboard, and `/api/*` uses the shared handlers.

<br>

## Deployment

| Variable | Required | Description |
|----------|----------|-------------|
| `PASSWORD_HASH` | No | Server-only PBKDF2 `hash:salt`; unset keeps the existing public mode |
| `JWT_SECRET` | When password gate is enabled | Server-only signing secret for the existing JWT sessions |
| `SSL_ORIGIN_TOKEN` | Yes | Server-only credential for the protected certificate-probe origin |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |

<br>

## Contributing

> Contributions are welcome. Keep changes focused, tested, and aligned with the existing product direction.

1. Fork the repository and create a feature branch.
2. Install dependencies with `npm install`.
3. Run `npm run lint`, `npm run type-check`, and `npm run test` before opening a pull request.
4. Use `npm run test:gui` when your change touches interactive dashboard behavior.
5. Open a pull request with a concise summary of the problem, approach, and user-facing impact.

---

<br>

<div align="center">
  <sub>Built by <a href="https://www.seanguillermo.com"><strong>Sean G</strong></a></sub>
</div>

## Cloudflare release

The Worker is `seankrux-domainpulse` in Sean's personal account `7a7a08127b6d6744c838413b4473ecf1`: https://seankrux-domainpulse.seanllms.workers.dev. `npm run build:cloudflare` builds both applications and a curated assets directory. The Cloudflare workflow tests PRs and deploys `main`; its `CLOUDFLARE_API_TOKEN` is a repository secret. Vercel Git deployments are disabled, its old deploy workflows are removed, and the Vercel project is retained.

Workers HTTP calls retain private-address/DNS validation and manual redirects, using [public-only fetch routing](https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public). DNS enrichment uses DNS-over-HTTPS with the existing record shapes. The [Workers HTTPS runtime](https://developers.cloudflare.com/workers/runtime-apis/nodejs/https/) does not expose the peer socket, so certificate metrics use the existing pinned Node TLS lookup in a protected, loopback-only Tokyo service behind the personal Cloudflare tunnel. Its origin bearer credential is configured in Worker secrets and the private systemd environment; it is absent from frontend assets.

The release workflow publishes the compiled TLS helper plus its source commit and SHA-256 digest as the `domainpulse-origin` artifact. The Tokyo updater accepts an artifact only from successful Cloudflare CI for the exact current `main` SHA, validates its digest, installs it atomically, restarts the origin, and checks real certificate data. A five-minute systemd timer handles subsequent releases; failed verification restores the previous bundle. Services `domainpulse-origin.service` and `domainpulse-origin-tunnel.service` use automatic restart and start at boot. No application data is stored by this helper.

Authentication remains opt-in. The server-only `PASSWORD_HASH`/`JWT_SECRET` pair can be applied through the manual Cloudflare auth workflow when those repository secrets are configured; migration does not invent a user password. An unset Google Places key retains the existing `UNKNOWN` GMB enrichment state. Domain lists and history retain the existing browser-storage behavior.

The former native Cloudflare build connection for legacy Worker `domainpulse` is removed after a recorded failed build; the Worker itself is retained; GitHub Actions is the sole deploy pipeline for `seankrux-domainpulse`. CI supports the repository's isolated ephemeral `CLOUDFLARE_RUNNER` setting and excludes external-fork PRs from that host.
