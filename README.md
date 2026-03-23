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

<p align="center">
  <a href="https://domainpulse.vercel.app"><strong>Live Demo &rarr;</strong></a>
</p>

---

## Screenshots

> Visit the [live demo](https://domainpulse.vercel.app) to explore the full dashboard.

---

## Key Features

- 🔍 **Uptime Monitoring** — Latency tracking with history charts
- 🔒 **SSL Tracking** — Certificate status and expiry alerts
- 📅 **Domain Expiry** — WHOIS-based expiration tracking
- 🌐 **DNS Lookup** — Full DNS record inspection
- 🏷️ **Groups & Tags** — Organize domains into logical groups
- 🔔 **Notifications** — Browser, Slack, and Discord webhooks
- 🔊 **Sound Alerts** — Web Audio API notifications
- 📥 **CSV Import/Export** — Bulk domain management
- 🌙 **Dark Mode** — Full dark theme support
- 🔑 **Password Auth** — PBKDF2 + salt authentication
- ⚡ **Web Worker** — Non-blocking background monitoring

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

## Getting Started

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

### Authentication Setup

Create `.env.local`:

```bash
VITE_PASSWORD_HASH=<your-pbkdf2-hash:salt>
```

Generate a hash:

```bash
node -e "const crypto = require('crypto'); const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.pbkdf2Sync('your-password', salt, 100000, 32, 'sha256').toString('hex'); console.log(hash + ':' + salt);"
```

---

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

---

## Architecture

Two React apps built from a single codebase:

| App | Entry | Port |
|-----|-------|------|
| DomainPulse | `index.html` / `App.tsx` | 3000 |
| Marketing Site | `site.html` / `SiteApp.tsx` | 3002 |

- **Local dev** — Vite proxies `/api/*` to Express (port 3001)
- **Production** — Vercel serverless functions via `vercel.json` rewrites

---

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/seankrux/domainpulse)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_PASSWORD_HASH` | Yes | PBKDF2 `hash:salt` for auth |
| `ALLOWED_ORIGINS` | No | CORS origins (comma-separated) |

---

## License

[MIT](LICENSE)

---

<div align="center">
  <p>Made with 💛 by Sean G</p>
</div>
