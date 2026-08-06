# PulseSEO — GSC Command Center

Chrome Manifest V3 side panel for Google Search Console: live analytics, URL Inspection, sitemap/WebSub, bulk inspect, on-page audit, and local notes — **without an SEO Gets (or other SaaS) account**.

## Competitive context

| Capability | SEO Gets Anywhere | GSC-URL-Indexer | IndexWizard / Leo | **PulseSEO** |
| --- | --- | --- | --- | --- |
| Page/domain GSC metrics + growing/decaying queries | Yes (SaaS) | — | CLI / web | **Yes (direct API)** |
| Annotations | SaaS sync | — | — | **Local notes + chart markers** |
| URL Inspection | — | Via GSC UI automation | API | **API + deep link** |
| Request indexing | — | GSC UI automation | Indexing API | **GSC deep link (primary) + Indexing API try** |
| Sitemap submit + WebSub ping | — | — | Leo ping | **Yes** |
| Bulk sitemap inspect + CSV | — | Queue/badge | Export | **Monitor tab (≤25/run) + CSV** |
| Quota meter | — | ~10/day UI | — | **Inspect/index daily meter** |
| On-page DOM audit | — | — | — | **Yes** |
| Device / search-type filters | SaaS | — | — | **Yes** |
| Requires paid SaaS | Yes | No | No | **No** |

Research notes: SEO Gets Anywhere is read-only analytics + annotations against their backend. GSC-URL-Indexer automates the GSC UI (fragile/ToS-sensitive). Leo adds sitemap→inspect→submit + WebSub. PulseSEO combines the analytics UX with official APIs and honest Indexing API limits.

## Install (unpacked)

1. `chrome://extensions` → Developer mode → **Load unpacked** → this `chrome-extension/` folder.
2. Copy the extension **ID**.
3. [Google Cloud Console](https://console.cloud.google.com/):
   - Enable **Google Search Console API** (and optionally **Indexing API**).
   - OAuth consent screen → Testing → add yourself as test user → add scopes `webmasters` + `indexing`.
   - Create OAuth client type **Chrome Extension** with that Item ID *(no redirect URI needed)*.
   - Fallback only: Web application client must authorize exactly `https://<EXTENSION_ID>.chromiumapp.org/`.
4. Extension **Options** → paste Client ID → Save → Test sign-in.
5. Open the side panel on an `http(s)` page you own in Search Console.

### Permissions

**Chrome:** `storage`, `identity`, `sidePanel`, `scripting`, `tabs`; hosts for Google APIs, WebSub hub, and `http(s)://*/*` (on-page audit + sitemap fetch).

**OAuth scopes:** `https://www.googleapis.com/auth/webmasters`, `https://www.googleapis.com/auth/indexing`.

**GSC role:** Owner/Full recommended for Inspection and sitemap writes.

### Indexing — what actually works

- **Supported path:** Actions → **Open GSC Inspection** → use Google’s Request indexing button.
- **Experimental:** Indexing API `URL_UPDATED` / `URL_DELETED` with the user OAuth token. Google documents **service-account** auth for this API; user tokens often **403**. PulseSEO surfaces that error and still offers the GSC deep link.

## Tabs

| Tab | Features |
| --- | --- |
| **Analytics** | Page/domain metrics, prior-period deltas, device + search-type filters, trend chart with note markers, growing/decaying/new queries, CSV export |
| **Inspect** | URL Inspection API detail + export JSON + open GSC |
| **Monitor** | Load sitemap / paste URLs → bulk inspect (25/run) → Indexed/Not/Error filters → CSV |
| **Actions** | GSC Inspection deep link, Indexing API try, sitemap submit + WebSub ping, quota meter |
| **On-page** | Live DOM audit (title/meta/canonical/robots/OG/H1/JSON-LD/issues) |
| **Notes** | Local page/property annotations |

Context **auto-refreshes** when the **active** tab changes or finishes loading. Hit **Refresh** if a page is still loading.

Property matching: longest URL-prefix (same origin + path) → then `sc-domain:`. No unsafe host-prefix string matching; no silent www↔apex URL-prefix bind. If only `www.` is verified as a URL-prefix property, open the www URL (or use Domain scope / `sc-domain:`).

## Develop / test

```bash
npm run test:ext   # pure helper tests (matchProperty, dates, deltas, client id)
```

No build step — load the folder as unpacked.

## Security notes

- Messages accepted only from this extension’s pages (`sender.id` + `chrome-extension://` URL).
- External tabs open only to allowlisted hosts (`search.google.com`, Cloud Console, Google account).
- Mutating GSC calls verify the property is owned and the URL belongs to it.
- Access tokens live in `chrome.storage.session`; Client ID in `sync`; notes/quota in `local`.
- Implicit OAuth (`response_type=token`) — no refresh token; silent `prompt=none` when possible.

## Layout

```
chrome-extension/
  manifest.json
  background/service-worker.js
  lib/{auth,gsc,dates,quota,constants}.js
  content/page-audit.js
  sidepanel/{index.html,app.js,styles.css}
  options/{index.html,options.js}
  icons/
  tests/gsc-helpers.test.mjs
  README.md
```
