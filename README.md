<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

<h1 align="center">DomainPulse</h1>
<p align="center"><strong>Real-time domain monitoring dashboard for uptime, SSL, DNS, and expiry tracking.</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

DomainPulse is a self-hosted domain monitoring dashboard that tracks uptime, SSL certificates, DNS records, and domain expiry in real-time. It ships with a companion marketing site powered by a file-based CMS.

<p align="center">
  <a href="https://domainpulse.vercel.app"><strong>Live Demo &rarr;</strong></a>
</p>

---

## Features

- **Uptime monitoring** with latency tracking and history charts
- **SSL certificate** status and expiry alerts
- **Domain expiry** (WHOIS) tracking
- **DNS record** lookup
- **Groups and tags** for organizing domains
- **Notifications** via browser, Slack, and Discord webhooks
- **Sound alerts** via Web Audio API
- **CSV import/export** and bulk domain import
- **Dark mode**
- **Password-protected auth** (PBKDF2 + salt)
- **Web Worker** background monitoring (non-blocking UI)
- **Companion marketing site** with file-based CMS and blog

---

## Quick Start

```bash
# Install dependencies
npm install

# Run DomainPulse dashboard + proxy server
npm run dev:all
# Open http://localhost:3000

# Run the marketing site
npm run dev
# Open http://localhost:3002
```

### Authentication Setup

Create `.env.local` for local development:

```bash
VITE_PASSWORD_HASH=<your-pbkdf2-hash:salt>
```

Generate a password hash:

```bash
node -e "const crypto = require('crypto'); const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.pbkdf2Sync('your-password', salt, 100000, 32, 'sha256').toString('hex'); console.log(hash + ':' + salt);"
```

---

## Architecture

### Dual-Target Build

Two separate React apps are built from a single codebase:

| App | Entry | Config | Port | Output |
|-----|-------|--------|------|--------|
| DomainPulse | `index.html` / `App.tsx` | `vite.config.ts` | 3000 | `dist/` |
| Marketing Site | `site.html` / `SiteApp.tsx` | `vite.site.config.ts` | 3002 | `dist-site/` |

### Proxy Architecture

- **Local dev** &mdash; Vite (port 3000) proxies `/api/*` to an Express server (port 3001)
- **Production** &mdash; Vercel serverless functions handle `/api/*` via `vercel.json` rewrites

### Web Worker Integration

Monitoring checks run in a dedicated Web Worker to keep the UI responsive, with automatic fallback to main-thread processing.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Build | Vite 6 |
| Charts | Recharts |
| Icons | Lucide React |
| Server | Express (dev proxy), Vercel Serverless (prod) |
| Testing | Vitest, Playwright |

---

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Dashboard + proxy server (recommended) |
| `npm run dev` | Marketing site only |
| `npm run build:all` | Build both apps |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript type checking |
| `npm run test` | Vitest unit tests |
| `npm run test:gui` | Playwright E2E tests |

---

## Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/seankrux/domainpulse)

Set these environment variables in Vercel:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_PASSWORD_HASH` | Yes | PBKDF2 `hash:salt` for authentication |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |

### CLI Deploy

```bash
npm i -g vercel
vercel --prod
```

---

## License

[MIT](LICENSE)

---

<div align="center">
  <p>Made with 💛 by Sean G</p>
</div>
