<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DomainPulse

A professional domain monitoring dashboard for tracking uptime, SSL certificates, DNS, and domain expiry in real-time. Built with React 19, TypeScript, Vite, and Tailwind CSS v4.

Includes a companion **YourBrand** marketing site (file-based CMS).

---

## Quick Start

```bash
# Install dependencies
npm install

# Run DomainPulse (monitoring dashboard + proxy server)
npm run dev:all
# Open http://localhost:3000

# Run YourBrand (marketing site)
npm run dev
# Open http://localhost:3002
```

### Default Login

For local development, create `.env.local`:
```bash
# Pre-generated hash for password "testpassword"
VITE_PASSWORD_HASH=<your-pbkdf2-hash:salt>
```

Generate a new password hash:
```bash
node -e "const crypto = require('crypto'); const salt = crypto.randomBytes(16).toString('hex'); const hash = crypto.pbkdf2Sync('your-password', salt, 100000, 32, 'sha256').toString('hex'); console.log(hash + ':' + salt);"
```

---

## Features

### DomainPulse (Monitoring Dashboard)
- Domain uptime monitoring with latency tracking
- SSL certificate status and expiry alerts
- Domain expiry (WHOIS) tracking
- DNS record lookup
- Groups and tags for organizing domains
- History charts (response time + status timeline)
- Browser notifications + Slack/Discord webhooks
- Sound alerts via Web Audio API
- CSV import/export
- Bulk domain import
- Dark mode
- Password-protected authentication (PBKDF2 + salt)
- Web Worker-based background monitoring (non-blocking UI)
- Vercel-ready deployment

### YourBrand (Marketing Site)
- File-based CMS (markdown content)
- Blog with frontmatter support
- Dark/light theme toggle
- Responsive design
- Vercel-ready deployment

---

## Architecture

### Dual-Target Build

The project builds **two separate React apps** from the same codebase:

| App | Entry | Config | Port | Output |
|-----|-------|--------|------|--------|
| DomainPulse | `index.html` + `index.tsx` + `App.tsx` | `vite.config.ts` | 3000 | `dist/` |
| YourBrand | `site.html` + `siteIndex.tsx` + `SiteApp.tsx` | `vite.site.config.ts` | 3002 | `dist-site/` |

### Two-Proxy Architecture

- **Local dev**: Vite dev server (port 3000) proxies `/api/*` to Express server (port 3001)
- **Production (Vercel)**: `/api/*.ts` serverless functions handle requests directly via `vercel.json` rewrites

The client-side services always call `/api/check` (relative URL), which works in both modes.

### Web Worker Integration

Domain monitoring checks are offloaded to a Web Worker (`services/monitoring.worker.ts`) to keep the UI responsive. The worker receives auth tokens via `CONFIG` message (since `localStorage` is unavailable in workers). Falls back to main-thread processing if the worker fails to initialize.

### Auth Flow

1. Login posts password to `/api/login`
2. Server PBKDF2-hashes it, compares to `VITE_PASSWORD_HASH`
3. On success, returns hash portion as session token
4. Token stored in `localStorage`, sent as `Authorization: Bearer <token>` on subsequent API calls
5. Note: Token is the PBKDF2 hash itself, not a JWT (see TODO below)

---

## Project Structure

```
domainpulse/
├── App.tsx                         # Main dashboard (all state management)
├── index.tsx                       # App entry (AuthProvider, NotificationProvider, ErrorBoundary)
├── index.html                      # App HTML shell
├── SiteApp.tsx                     # Marketing site SPA router
├── siteIndex.tsx                   # Marketing site entry
├── site.html                       # Marketing site HTML shell
├── types.ts                        # All shared TypeScript interfaces & enums
│
├── components/
│   ├── AuthProvider.tsx             # Auth context (login/logout/session)
│   ├── AuthGuard.tsx                # Route gate (login wall)
│   ├── LoginPage.tsx                # Password login UI
│   ├── ErrorBoundary.tsx            # React error boundary
│   ├── NotificationProvider.tsx     # Toast notification system
│   ├── DomainTable.tsx              # Main table (inline edit, tags, groups, badges)
│   ├── StatsOverview.tsx            # Stat cards + PieChart
│   ├── AlertSummary.tsx             # Expiry/SSL alert panel
│   ├── HistoryChart.tsx             # Latency AreaChart + status timeline
│   ├── GroupManager.tsx             # Group CRUD modal
│   ├── SiteLayout.tsx               # Marketing site layout
│   ├── ContentRenderer.tsx          # Markdown renderer (via `marked`)
│   └── Dashboard/
│       ├── Header.tsx               # App header (dark mode, settings, logout)
│       ├── HeroSection.tsx          # Domain input + bulk import trigger
│       ├── FilterBar.tsx            # Search, filters, sort, CSV upload/download
│       ├── SettingsPanel.tsx         # All settings (webhooks, UA, timeout)
│       ├── BulkImportModal.tsx       # Bulk domain paste/import
│       └── DomainDetailModal.tsx     # Per-domain detail (SSL, expiry, DNS)
│
├── services/
│   ├── domainService.ts             # URL validation + checkDomainWithSSL()
│   ├── monitoring.worker.ts         # Web Worker for background checks
│   ├── sslService.ts                # SSL check via API
│   ├── expiryService.ts             # WHOIS/expiry via API
│   ├── dnsService.ts                # DNS lookup via API
│   └── notificationService.ts       # Browser notifs + Slack/Discord webhooks
│
├── hooks/
│   └── useMonitoring.ts             # Worker lifecycle + batch/single check
│
├── api/                             # Vercel serverless functions (production)
│   ├── login.ts                     # POST /api/login
│   ├── check.ts                     # GET /api/check (uptime check)
│   ├── ssl.ts                       # GET /api/ssl (TLS cert extraction)
│   ├── whois.ts                     # GET /api/whois (domain expiry)
│   ├── dns.ts                       # GET /api/dns (DNS lookup)
│   └── _utils/
│       └── auth.ts                  # Shared auth/CORS helpers
│
├── server/
│   └── proxy.ts                     # Express dev proxy (port 3001)
│
├── lib/
│   ├── config.ts                    # Centralized config constants
│   └── content.ts                   # Markdown CMS content loader
│
├── utils/
│   ├── storage.ts                   # localStorage CRUD (domains, groups, settings)
│   ├── csvHelper.ts                 # CSV parse/export
│   └── logger.ts                    # Singleton logger with ring buffer
│
├── data/
│   └── seed.ts                      # Sample domains & groups for first launch
│
├── content/                         # Marketing site CMS content
│   ├── pages/
│   │   ├── home.md
│   │   ├── about.md
│   │   └── contact.md
│   └── posts/
│       ├── index.json
│       └── welcome.md
│
├── tests/
│   ├── setup.ts                     # Vitest setup (mocks)
│   ├── dashboard.spec.ts            # Playwright: add-domain flow
│   ├── comprehensive.spec.ts        # Playwright: settings, filters, groups
│   └── automated_build_verify.spec.ts  # Playwright: production build
│
├── scripts/
│   └── verify_and_launch.sh         # Build + test + launch helper
│
├── vite.config.ts                   # App Vite config
├── vite.site.config.ts              # Marketing site Vite config
├── vitest.config.ts                 # Vitest unit test config
├── playwright.config.ts             # Playwright E2E config
├── tsconfig.json                    # TypeScript config (strict mode)
├── vercel.json                      # Vercel deployment + API rewrites
├── tailwind.config.js               # Tailwind CSS config
├── postcss.config.js                # PostCSS config
└── package.json                     # Dependencies & scripts
```

---

## Available Commands

| Command | Description | Port |
|---------|-------------|------|
| `npm run dev:all` | DomainPulse + Proxy server (recommended) | 3000 + 3001 |
| `npm run dev:app` | DomainPulse frontend only | 3000 |
| `npm run server` | Proxy server only | 3001 |
| `npm run dev` | YourBrand marketing site | 3002 |
| `npm run build:app` | Build DomainPulse | - |
| `npm run build` | Build YourBrand site | - |
| `npm run build:all` | Build both apps | - |
| `npm run preview` | Preview marketing site build | 3002 |
| `npm run lint` | ESLint (custom formatter) | - |
| `npm run lint:fix` | ESLint with auto-fix | - |
| `npm run type-check` | TypeScript type checking | - |
| `npm run test` | Vitest unit tests | - |
| `npm run test:coverage` | Vitest with coverage | - |
| `npm run test:gui` | Playwright E2E tests | - |
| `npm run test:gui:report` | View Playwright report | - |

---

## Environment Variables

Create `.env.local` for local development, or set in Vercel for production:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_PASSWORD_HASH` | Yes (production) | `''` | PBKDF2 `hash:salt` for authentication |
| `VITE_PROXY_URL` | No | `http://localhost:3001` | Backend proxy URL for local dev |
| `ALLOWED_ORIGINS` | No | `*` | CORS origins for Vercel functions (comma-separated) |
| `PROXY_PORT` | No | `3001` | Port for local dev proxy server |
| `VITE_AUTH_SESSION_TTL_MINUTES` | No | `720` (12 hours) | Auth session duration |
| `VITE_ALLOW_INITIAL_LOGIN` | No | `false` | Enable first-run password setup flow |
| `VITE_SITE_URL` | No | `http://localhost:3002` | Marketing site URL (for "Website" link) |
| `VITE_APP_URL` | No | `http://localhost:3000` | Dashboard URL (for "Launch App" link) |

---

## API Endpoints

All endpoints available at `/api/*` (proxied in dev, serverless in production):

| Method | Endpoint | Auth | Rate Limited | Description |
|--------|----------|------|-------------|-------------|
| POST | `/api/login` | No | No | Authenticate with password |
| GET | `/api/check?url=<domain>` | Yes | Yes (100/min) | Check domain uptime + latency |
| GET | `/api/ssl?domain=<domain>` | Yes | Yes (100/min) | Get SSL certificate info |
| GET | `/api/whois?domain=<domain>` | Yes | Yes (100/min) | Get WHOIS/expiry info |
| GET | `/api/dns?domain=<domain>` | Yes | No | Get DNS records |

---

## Deploy to Vercel

### Option 1: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/domainpulse)

### Option 2: Automatic Deployment via GitHub Actions

This project includes a GitHub Actions workflow that automatically deploys to Vercel on every push to `main` branch.

#### Setup Steps:

**1. Get Vercel Credentials**

- **Vercel Token:** Go to [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token → Copy it
- **Project ID:** In Vercel dashboard → Your Project → Settings → General → Copy "Project ID"
- **Team ID (if using teams):** Vercel → Settings → Team → Copy "Team ID"

**2. Add GitHub Secrets**

Go to `github.com/YOUR_USERNAME/domainpulse/settings/secrets/actions` and add:

| Secret Name | Value |
|-------------|-------|
| `VERCEL_TOKEN` | Your Vercel token from step 1 |
| `VERCEL_PROJECT_ID` | Your project ID from step 1 |
| `VERCEL_ORG_ID` | Your team ID (optional for personal accounts) |

**3. Add Vercel Environment Variables**

In Vercel dashboard → Your Project → Settings → Environment Variables:

| Variable | Value | Environments |
|----------|-------|--------------|
| `VITE_PASSWORD_HASH` | Your PBKDF2 hash | Production, Preview, Development |
| `AUTH_SECRET` | Random secure string | Production, Preview |

**4. Push to Deploy**

Once configured, every push to `main` will:
1. Run tests (type-check, unit tests)
2. Deploy to Vercel Production
3. Show deployment status in GitHub

### Option 3: Manual CLI Deploy

```bash
# Install Vercel CLI
npm install --global vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

Set `VITE_PASSWORD_HASH` and `AUTH_SECRET` in Vercel environment variables.

---

## CI/CD Pipeline

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Push to main   │ ──→ │ Run Tests    │ ──→ │ Deploy to Vercel│
│  (GitHub)       │     │ (GitHub)     │     │ (Vercel)        │
└─────────────────┘     └──────────────┘     └─────────────────┘
                              │                      │
                              ▼                      ▼
                       Test Reports          Live URL + Status
                       in GitHub             in GitHub + Vercel
```

**Workflow Files:**
- `.github/workflows/deploy.yml` - Production deployment
- `.github/workflows/automated-tests.yml` - Full test suite
- `.github/workflows/gui-tests.yml` - GUI/Playwright tests

---

## Debugging

### Chrome DevTools Helper

Open browser console (F12) and run:
```javascript
await import('/devtools-helper.js')
```

Available commands: `generateDebugReport()`, `getLocalStorageData()`, `getNetworkFailures()`, `checkAPIEndpoints()`, `resetApp()`, `monitorStorage('key')`, `captureErrors()`

### Common Fixes

```javascript
// Reset app to sample data
resetApp()

// Check saved domains
JSON.parse(localStorage.getItem('domainpulse_domains'))

// Check saved groups
JSON.parse(localStorage.getItem('domainpulse_groups'))

// Force refresh everything
localStorage.clear(); location.reload()
```

---

<div align="center">
  <p>Made with 💛 by Sean G</p>
</div>
