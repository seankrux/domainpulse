# PulseSEO — GSC Command Center

A Chrome extension that outperforms **SEO Gets Anywhere** by combining live GSC analytics with **real Search Console actions** (URL Inspection, indexing notifications, sitemap submit) plus an on-page SEO audit — all in a persistent side panel.

## Research: how SEO Gets Anywhere works

[SEO Gets](https://seogets.com/) is a SaaS layer on top of Google Search Console (and optionally GA4). Their Chrome extension, **SEO Gets Anywhere**, is a thin companion that requires an SEO Gets account.

| Capability | SEO Gets Anywhere | PulseSEO |
| --- | --- | --- |
| Page / domain clicks, impressions, CTR, position | Yes (via SEO Gets backend) | Yes (direct Search Console API) |
| Top queries + growing / decaying / new | Yes | Yes |
| Annotations while browsing | Yes → syncs to SEO Gets | Yes → local notes (no SaaS lock-in) |
| Jump to filtered dashboard | SEO Gets only | Opens native GSC deep links |
| **URL Inspection** (coverage, crawl, canonicals) | No | Yes (URL Inspection API) |
| **Request indexing** | No (Index Reporting is a paid SaaS feature elsewhere) | Yes — Indexing API notify + one-click open GSC Inspection |
| Sitemap submit | No | Yes |
| Live on-page SEO audit | No | Yes (title, meta, H1, canonical, robots, OG, JSON-LD, issues) |
| Requires paid third-party account | Yes | No — your Google Cloud OAuth only |
| UI surface | Toolbar popup | Side panel (stays open while you browse) |

### SEO Gets Anywhere data flow (summary)

1. You connect GSC to SEO Gets (OAuth to their SaaS).
2. They pull Search Analytics (up to ~50k rows vs GSC UI’s 1k) into their dashboard.
3. The extension authenticates against **SEO Gets**, not GSC directly, and shows cached/API page metrics + annotation forms for the current URL when it matches a connected property.
4. Annotations sync to their timeline and can kick off before/after “SEO tests.”
5. The connection is described as read-only for GSC — the extension does **not** expose Inspection or indexing request tools.

### Why “request indexing” needs two paths

- **URL Inspection API** (`searchconsole.googleapis.com/.../urlInspection/index:inspect`) is **read-only** — great for status, not for submitting a crawl request.
- **Indexing API** (`indexing.googleapis.com/.../urlNotifications:publish`) can send `URL_UPDATED` / `URL_DELETED`, but Google documents it for **JobPosting / BroadcastEvent** pages, with quota/approval limits.
- The everyday “Request indexing” button lives in the **GSC UI**. PulseSEO deep-links straight to Inspection for the current URL so you can click it in one step, and optionally fires Indexing API notifications when your project is set up for that.

## Install (unpacked)

1. Open `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select this `chrome-extension/` folder.
3. Note the extension **ID** on the card.
4. Open **PulseSEO Settings** (extension Details → Extension options, or the ⚙ in the side panel).
5. In [Google Cloud Console](https://console.cloud.google.com/):
   - Enable **Google Search Console API** and **Indexing API**.
   - Create an OAuth client of type **Chrome Extension** using that Item ID.
   - Paste the Client ID into Settings → Save.
6. Pin PulseSEO → click the icon to open the **side panel** → **Sign in with Google**.
7. Browse a page on a property you own in Search Console.

### Permissions you’ll grant

- `https://www.googleapis.com/auth/webmasters` — sites list, search analytics, sitemaps, URL Inspection
- `https://www.googleapis.com/auth/indexing` — URL notification publish / metadata

Tokens are stored in `chrome.storage.session` only (cleared when the browser session ends). Your Client ID lives in `chrome.storage.sync`. Notes are local in `chrome.storage.local`.

## Usage

| Tab | What it does |
| --- | --- |
| **Analytics** | Page or domain metrics, prior-period deltas, trend chart, query filters (all / growing / decaying / new) |
| **Inspect** | Live URL Inspection result (coverage, robots, last crawl, Google/user canonicals, sitemaps) |
| **Actions** | Notify URL updated/deleted via Indexing API, open GSC Inspection for manual request, list & submit sitemaps |
| **On-page** | Injects a content audit on the active tab (no remote HTML fetch — uses the live DOM) |
| **Notes** | Page- or property-scoped annotations stored locally |

Property matching prefers the longest URL-prefix property that contains the page, then `sc-domain:` properties.

## Project layout

```
chrome-extension/
  manifest.json          # MV3 — sidePanel, identity, scripting
  background/            # Service worker: OAuth + GSC message API
  lib/auth.js            # launchWebAuthFlow + token cache
  lib/gsc.js             # Search Analytics, Inspection, Indexing, sitemaps
  lib/dates.js           # GSC date ranges / % change
  content/page-audit.js  # On-page SEO extractor
  sidepanel/             # Main UI
  options/               # Client ID setup
  icons/
```

## Limits & honesty

- Search Analytics has the same API lag (~2–3 days) and sampling/top-row behavior as GSC.
- Indexing API success ≠ guaranteed crawl/index; respect Google’s quotas and intended use.
- Chrome identity OAuth requires **your** Cloud project; this repo does not ship a shared Client ID.
- On-page audit cannot run on `chrome://` or Web Store pages (Chrome restriction).

## Superiority checklist vs SEO Gets Anywhere

- [x] Same core “metrics on this URL” workflow without a SaaS middleman  
- [x] Growing / decaying / new query views  
- [x] Annotations without leaving the page  
- [x] **URL Inspection** in-panel  
- [x] **Indexing request** paths (API + GSC deep link)  
- [x] Sitemap tooling  
- [x] On-page technical SEO audit  
- [x] Side panel UX that stays open across navigation  
