<div align="center">
  <img width="1200" height="475" alt="DomainPulse" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

<div align="center">
  <h1>DomainPulse</h1>
  <p><strong>Real-time domain monitoring dashboard for uptime, SSL, DNS, and expiry tracking</strong></p>

  <p>
    <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
    <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>

  <br />
  <a href="https://domainpulse.vercel.app"><strong>Live Demo →</strong></a>
</div>

---

## Overview

Full-featured domain monitoring dashboard that tracks uptime, SSL certificate status, DNS records, and domain expiration dates. Supports browser notifications, Slack/Discord webhooks, Web Audio alerts, and bulk CSV import/export. Runs two React apps from a single codebase — the dashboard and a marketing site.

## Why DomainPulse?

- **Unified monitoring surface** — DomainPulse is a modern React SPA that brings uptime, DNS, WHOIS, and SSL monitoring into one workflow instead of splitting critical domain intelligence across separate tools.

- **Built for fast operational signal** — Checks run in the background, historical status is retained locally, and alerts can reach the browser, Slack, Discord, and Web Audio channels without adding heavy infrastructure.

- **Productized beyond a demo** — It ships with a protected dashboard, bulk domain management, a dedicated marketing site, and a deployment-ready serverless API layer from a single codebase.

## Preview

> [View the live application →](https://domainpulse.vercel.app)

## Features

▸ **Uptime Monitoring** — Latency tracking with history charts

▸ **SSL Tracking** — Certificate status and expiry alerts

▸ **Domain Expiry** — WHOIS-based expiration tracking

▸ **DNS Lookup** — Full DNS record inspection

▸ **Groups and Tags** — Organize domains into logical groups

▸ **Notifications** — Browser, Slack, and Discord webhook support

▸ **Sound Alerts** — Web Audio API notifications

▸ **CSV Import/Export** — Bulk domain management

▸ **Password Auth** — PBKDF2 + salt authentication

▸ **Web Worker** — Non-blocking background monitoring

## How It Works

DomainPulse routes domain checks through a single authenticated API surface: Vercel serverless functions in production and an Express proxy during local development. Each monitoring pass follows a layered pipeline so the UI stays responsive while the app collects richer domain intelligence.

1. **Normalize and queue domains** — User input is validated, normalized to a clean domain, and queued for checking by the monitoring hook or Web Worker batch runner.
2. **Measure uptime first** — `/api/check` performs a fast `HEAD` request against the target domain to determine availability, status code, and latency.
3. **Enrich results in parallel** — After uptime succeeds, DomainPulse concurrently calls `/api/ssl`, `/api/whois`, and `/api/dns` to gather certificate validity, expiration metadata, registrar details, and live DNS records.
4. **Persist and visualize state** — Results are merged into the dashboard, appended to each domain’s history, and stored in `localStorage` so operators keep context across sessions.
5. **Notify on meaningful changes** — Status transitions can trigger browser notifications, Slack or Discord webhooks, and optional sound alerts for immediate operator feedback.

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| UI | React 19, TypeScript, Tailwind CSS v4 | Modern SPA interface for the dashboard and marketing site |
| Build & Dev Workflow | Vite 6, TSX, Concurrently | Fast local iteration, dual-app development, and production builds |
| Data Visualization | Recharts | Latency and status history charts |
| Icons & UI Assets | Lucide React | Lightweight iconography across the product |
| Monitoring Engine | Web Workers, Fetch API, Web Audio API | Background checks, responsive UI updates, and audible alerts |
| API Layer | Express (dev proxy), Vercel Serverless (prod) | Unified monitoring endpoints for uptime, DNS, WHOIS, and SSL checks |
| Network & Domain Intelligence | Node `https`, `tls`, `dns` | Certificate inspection, DNS resolution, and domain reachability checks |
| Authentication & Security | PBKDF2, JWT, CORS controls, rate limiting | Password protection and guarded API access |
| Client Persistence | `localStorage`, `sessionStorage` | Domain lists, settings, history, and authenticated session state |
| Testing & Quality | Vitest, Testing Library, Playwright, ESLint | Unit coverage, UI verification, end-to-end tests, and code quality checks |
| Deployment | Vercel, `vercel.json` rewrites | Serverless production deployment and API routing |

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
# Install dependencies
npm install

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

## Architecture

Two React apps built from a single codebase:

| App | Entry | Port |
|-----|-------|------|
| DomainPulse | `index.html` / `App.tsx` | 3000 |
| Marketing Site | `site.html` / `SiteApp.tsx` | 3002 |

● **Local dev** — Vite proxies `/api/*` to Express on port 3001

● **Production** — Vercel serverless functions via `vercel.json` rewrites

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/seankrux/domainpulse)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_PASSWORD_HASH` | Yes | PBKDF2 `hash:salt` for auth |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |

## Contributing

Contributions are welcome. If you want to improve DomainPulse, keep changes focused, tested, and aligned with the existing product direction.

1. Fork the repository and create a feature branch.
2. Install dependencies with `npm install`.
3. Run `npm run lint`, `npm run type-check`, and `npm run test` before opening a pull request.
4. Use `npm run test:gui` when your change touches interactive dashboard behavior.
5. Open a pull request with a concise summary of the problem, approach, and user-facing impact.

## License

[MIT](LICENSE)

---

<p align="center">Made with 💛 by Sean G</p>
