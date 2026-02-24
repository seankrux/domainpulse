<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# DomainPulse + YourBrand

Two powerful tools in one repository:

1. **DomainPulse** - Domain monitoring & SSL tracking tool
2. **YourBrand** - Modern file-based CMS website

## Quick Start

### Run DomainPulse (Domain Monitoring Tool)
```bash
npm install
npm run dev:all
```
Open **http://localhost:3000**

### Run YourBrand (CMS Website)
```bash
npm run dev
```
Open **http://localhost:3002**

## Navigation Between Apps

- From **YourBrand CMS** (port 3002): Click **"Launch App"** button in navigation
- From **DomainPulse** (port 3000): Click **"Website"** link in header

---

## DomainPulse Features

- ✅ **Domain Monitoring** - Track uptime and latency
- ✅ **SSL Certificate Tracking** - Monitor expiry and issuer
- ✅ **Domain Expiry Tracking** - Never let a domain expire
- ✅ **Groups & Tags** - Organize domains
- ✅ **History Charts** - Visualize uptime and response times
- ✅ **Browser Notifications** - Get alerts for downtime
- ✅ **Sound Alerts** - Audio notifications
- ✅ **Dark Mode** - Easy on the eyes
- ✅ **Authentication** - Password-protected access
- ✅ **Vercel Ready** - One-click deployment

## YourBrand CMS Features

- ✅ **File-Based CMS** - Content lives in markdown files
- ✅ **AI-Editable** - Ask AI to create/update content
- ✅ **No Signup Required** - No database or CMS account needed
- ✅ **Full Control** - Edit files directly in GitHub or locally
- ✅ **Dark Mode** - Built-in theme toggle
- ✅ **Responsive** - Mobile-friendly design
- ✅ **Vercel Ready** - Auto-deploy on push

---

## Project Structure

```
domainpulse/
├── App.tsx              # DomainPulse main app
├── index.tsx            # DomainPulse entry point
├── index.html           # DomainPulse HTML (port 3000)
├── vite.config.ts       # DomainPulse Vite config
│
├── SiteApp.tsx          # YourBrand CMS main app
├── siteIndex.tsx        # YourBrand CMS entry point
├── site.html            # YourBrand CMS HTML (port 3002)
├── vite.site.config.ts  # YourBrand CMS Vite config
│
├── content/             # CMS content files
│   ├── pages/           # Static pages
│   └── posts/           # Blog posts
│
├── api/                 # Vercel serverless functions
│   ├── check.ts         # Domain checking API
│   ├── ssl.ts           # SSL certificate API
│   └── whois.ts         # WHOIS expiry API
│
├── components/          # React components
├── services/            # Business logic services
└── utils/               # Utility functions
```

---

## Available Commands

| Command | Description | Port |
|---------|-------------|------|
| `npm run dev:all` | **DomainPulse + Proxy** (recommended) | 3000 + 3001 |
| `npm run dev:app` | DomainPulse frontend only | 3000 |
| `npm run server` | Proxy server only | 3001 |
| `npm run dev` | YourBrand CMS website | 3002 |
| `npm run build:app` | Build DomainPulse | - |
| `npm run build` | Build YourBrand CMS | - |
| `npm run preview` | Preview CMS production build | 3002 |

---

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/domainpulse)

Or manually:
```bash
vercel
```

### Environment Variables

Create `.env.local` or set in Vercel:

```bash
# Password hash for authentication
VITE_PASSWORD_HASH=<sha256-hash>

# Generate hash using:
node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-password')).then(hash => console.log(Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')))"
```

---

## DomainPulse Usage

### Add Domains
1. Login with your password
2. Enter domain in the input field (e.g., `google.com`)
3. Click **Track**

### Manage Groups
1. Click the **Folder+ icon** next to Group filter
2. Create groups (e.g., "Production", "Personal")
3. Assign domains to groups

### View History
- Click the **clock icon** on any domain
- See response time charts and uptime timeline

### Enable Notifications
1. Open **Settings** (gear icon)
2. Enable **Browser Notifications**
3. Enable **Sound Alerts** for audio notifications

---

## YourBrand CMS Usage

### Create Content

**Ask AI to write content:**
```
"Create a blog post about our new product launch"
"Add an about page for my consulting business"
"Write a welcome post for the homepage"
```

**Or edit manually:**

Create `/content/posts/my-post.md`:
```markdown
---
title: My Blog Post
excerpt: A brief description of the post
date: 2026-02-17
tags: tech, update
author: Your Name
---

# Your Content Here

Write your blog post in markdown...
```

### Edit Pages

Content lives in `/content/pages/`:
- `home.md` - Homepage
- `about.md` - About page
- `contact.md` - Contact page

---

**Ready to start?** Run `npm run dev:all` for DomainPulse or `npm run dev` for YourBrand CMS!
```

**Or edit manually:**

Create `/content/posts/my-post.md`:
```markdown
---
title: My Blog Post
excerpt: A brief description of the post
date: 2026-02-17
tags: tech, update
author: Your Name
---

# Your Content Here

Write your blog post in markdown...
```

## Features

- ✅ **No CMS signup** - Content is just files in your repo
- ✅ **AI-editable** - Ask AI to create/update content
- ✅ **Full control** - Edit files directly in GitHub or locally
- ✅ **Dark mode** - Built-in dark/light theme toggle
- ✅ **Responsive** - Mobile-friendly design
- ✅ **Vercel ready** - One-click deployment

## Customization

### Change Branding

Edit `components/SiteLayout.tsx`:
- Change "YourBrand" to your name
- Update social links (GitHub, email)
- Modify navigation items

### Add Pages

1. Create markdown file in `/content/pages/`
2. Add to navigation in `components/SiteLayout.tsx`

### Styling

Uses Tailwind CSS. Customize in:
- `index.html` - Tailwind config
- Components - Direct className edits

## Project Structure

```
domainpulse/
├── content/              # Your content files
│   ├── pages/           # Static pages
│   └── posts/           # Blog posts
├── components/
│   ├── SiteLayout.tsx   # Main layout with nav/footer
│   └── ContentRenderer.tsx  # Markdown renderer
├── lib/
│   └── content.ts       # Content loading utilities
├── SiteApp.tsx          # Main app component
├── siteIndex.tsx        # Entry point
├── index.html           # HTML template
└── vite.site.config.ts  # Vite config
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3002) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run dev:app` | Original DomainPulse app |
| `npm run build:app` | Original DomainPulse build |

---

**Ready to build?** Just ask AI to create content or edit the markdown files directly!

See `SITE_README.md` for more details.

---

## 🔧 Debugging with Chrome DevTools

### Load DevTools Helper

Open browser console (F12) and run:

```javascript
// Load the helper script
await import('/devtools-helper.js')
```

### Available Commands

After loading the helper, use these commands:

| Command | What It Does |
|---------|-------------|
| `generateDebugReport()` | Full debug report with localStorage, network, state |
| `getLocalStorageData()` | Get all localStorage data as JSON |
| `getNetworkFailures()` | Get failed network requests |
| `checkAPIEndpoints()` | Check if API endpoints are working |
| `resetApp()` | Clear localStorage and reload (resets to sample data) |
| `monitorStorage('key')` | Monitor changes to specific localStorage key |
| `captureErrors()` | Start capturing console errors |

### Share Debug Info

When reporting issues, run `generateDebugReport()` and share the output. This helps identify:
- localStorage corruption
- Failed API requests
- Missing data
- State inconsistencies

### Common Fixes

**App shows errors on load:**
```javascript
resetApp()  // Clears data and reloads sample data
```

**Check if domains are saved:**
```javascript
JSON.parse(localStorage.getItem('domainpulse_domains'))
```

**Check if groups exist:**
```javascript
JSON.parse(localStorage.getItem('domainpulse_groups'))
```

**Force refresh all data:**
```javascript
localStorage.clear(); location.reload()
```

---

## 🏗 Architecture

### Background Monitoring (Web Workers)
To ensure the UI remains responsive while checking hundreds of domains, all status check logic is offloaded to a **Web Worker** (`services/monitoring.worker.ts`). This prevents the main thread from blocking during heavy network batching.

### Vite Proxy
The dashboard communicates with the backend via a Vite proxy configured in `vite.config.ts`. This allows the frontend to call `/api/*` endpoints without CORS or bundling issues.

## 🧪 Testing

### GUI & End-to-End Tests
We use Playwright for comprehensive GUI testing. The tests automatically start the development environment.

```bash
# Install test browsers
npx playwright install chromium

# Run tests
npm run test:gui

# View test report
npm run test:gui:report
```

---

<div align="center">
  <p>Made with 💛 by BigSean</p>
</div>
