# Developer Handoff - DomainPulse

> Last updated: 2026-02-24
> Current branch: `feature/domainpulse-updates-gemini`
> **Status Update**: HIGH PRIORITY items 1-5, MEDIUM PRIORITY items 6-7, and cleanup completed.

This document covers the current state of the project, what's complete, what needs finishing, and known issues. Read this before writing any code.

---

## Project Status: ~90% Complete

The core monitoring dashboard is fully functional. The marketing site is a working template. What remains is production hardening, testing, and some optional enhancements.

---

## What's DONE (Complete & Working)

### Core Features
- [x] Domain uptime monitoring with latency tracking
- [x] SSL certificate extraction and status display
- [x] DNS record lookup
- [x] Domain groups and tags (CRUD)
- [x] History charts (Recharts AreaChart + status timeline)
- [x] CSV import/export
- [x] Bulk domain import modal
- [x] Dark mode toggle
- [x] Search, filter, sort
- [x] Browser notifications (permission-gated)
- [x] Slack/Discord webhook notifications
- [x] Sound alerts (Web Audio API oscillator)
- [x] Per-domain detail modal (SSL, expiry, DNS tabs)

### Architecture
- [x] Web Worker for non-blocking background monitoring
- [x] PBKDF2 + salt password hashing (replaced SHA-256)
- [x] Centralized config (`lib/config.ts`)
- [x] Centralized logging (`utils/logger.ts` with ring buffer)
- [x] URL validation and sanitization (blocks dangerous protocols)
- [x] localStorage persistence with quota protection
- [x] Code splitting (Recharts 368KB and Lucide 26KB in separate chunks)
- [x] Memory leak prevention (bounded `previousStatuses` map)
- [x] Error boundary wrapping
- [x] Vercel serverless functions (5 endpoints)
- [x] Local dev Express proxy
- [x] ESLint + TypeScript strict mode
- [x] Playwright E2E test framework (3 test files)
- [x] Vitest unit test infrastructure (config + setup mocks)

### Marketing Site (YourBrand)
- [x] File-based CMS with markdown rendering
- [x] Blog with frontmatter support
- [x] Responsive layout
- [x] Dark/light theme
- [x] Separate Vite build config

---

## What NEEDS FINISHING

### HIGH PRIORITY

#### 1. WHOIS/Domain Expiry is Unreliable ✅ FIXED
**Files:** `api/whois.ts`

**FIXED**: Removed the fake data fallback. The endpoint now returns proper error messages when the WHOIS API fails instead of silently returning fake expiry dates.

**Remaining Action**: For production, consider integrating a reliable paid WHOIS API like whoisxmlapi.com for consistent results.

#### 2. No Unit Tests
**Files:** `tests/`, `vitest.config.ts`

Vitest is configured and `tests/setup.ts` has mocks ready, but **zero unit tests exist**. The three `.spec.ts` files in `tests/` are all Playwright E2E tests.

**Action:** Write unit tests for:
- `services/domainService.ts` - `validateAndNormalizeUrl()`, `checkDomainWithSSL()`
- `components/AuthProvider.tsx` - Login flow, session persistence
- `utils/storage.ts` - Save/load/quota handling
- `utils/csvHelper.ts` - Parse/export

#### 3. Auth Token is Not a JWT
**Files:** `api/login.ts`, `api/_utils/auth.ts`, `server/proxy.ts`

The auth "token" is literally the PBKDF2 hash portion of the password. This is acknowledged in comments (`"In a full app, this would be a JWT"`). Works for single-user private deployments but is not suitable for multi-user or production use.

**Action:** Implement proper JWT token generation with expiry, or accept this limitation and document it explicitly for users.

#### 4. Hardcoded localhost in Production Code ✅ FIXED
**File:** `components/Dashboard/Header.tsx:71`

**FIXED**: Now uses `VITE_SITE_URL` environment variable with fallback to `http://localhost:3002`.

**Action**: Set `VITE_SITE_URL` in your `.env.local` or Vercel environment variables for production deployments.

#### 5. Marketing Site Has Template Branding ✅ FIXED
**File:** `components/SiteLayout.tsx`

**FIXED**: Updated branding to DomainPulse:
- Logo text now says "DomainPulse"
- GitHub link points to `https://github.com/seankrux`
- Email is `mailto:contact@domainpulse.app`
- Footer updated with DomainPulse branding
- "Launch App" link now uses `VITE_APP_URL` environment variable

---

### MEDIUM PRIORITY

#### 6. SSL Endpoint CORS Inconsistency ✅ FIXED
**File:** `api/ssl.ts:57-59`

**FIXED**: CORS headers are now set before the method check, ensuring all response paths include proper CORS headers.

#### 7. Duplicate `DNSInfo` Type ✅ FIXED
**Files:** `types.ts`, `services/dnsService.ts`

**FIXED**: Removed the duplicate definition in `dnsService.ts` and now imports from `types.ts`.

#### 8. Unused Dependencies and Dead Code ✅ FIXED
**FIXED**: 
- Removed `uuid` from dependencies
- Removed unused `generateSampleHistory()` export from `data/seed.ts`

**Remaining**:
- `HistoryChart.tsx` accepts `onClose` prop but never calls it (cosmetic, can be removed later)
- `useMonitoring.ts` threads `showError`/`showInfo` props through but never calls them (cosmetic, can be removed later)

#### 9. Keyboard Shortcuts Displayed But Not Implemented ✅ FIXED
**File:** `App.tsx`

**FIXED**: Added `useEffect` hook to handle `Cmd+K` (focus search) and `Cmd+Enter` (check all) keyboard shortcuts.

#### 10. Playwright Test for Production Build Targets Wrong Port ✅ FIXED
**File:** `tests/automated_build_verify.spec.ts`

**FIXED**: Updated test to use `http://localhost:3000` which matches the `playwright.config.ts` webServer configuration.

---

### LOW PRIORITY

#### 11. Add Server-Side Rate Limiting on Client
The Vercel functions have rate limiting, but the client has no throttling for rapid user actions (e.g., spamming "Check All").

#### 12. Input Sanitization for CSV Imports
CSV import (`utils/csvHelper.ts`) parses user-provided files. Currently trusts input format.

#### 13. Consider Lighter Chart Library
Recharts chunk is 368KB. Lightweight alternatives could reduce bundle size.

#### 14. PWA Support
Add service worker for offline domain list access and background checks.

#### 15. Bulk Group Operations
No way to assign/remove groups for multiple domains at once.

---

## Cleanup ✅ COMPLETED

### Debug Artifacts - DELETED

All debug artifacts have been removed and added to `.gitignore`:

**Deleted:**
- Test scripts: `comprehensive_gui_test.cjs`, `standalone_verify.cjs`, `verify_updates.cjs`, `gui_test.py`, `debug_gui.py`, `inspect_*.py`
- Screenshots: All `*.png` files
- Directories: `venv/`, `playwright-report/`, `test-results/`, `.autonomous/`
- Log files: All `*.log` files

**.gitignore Updated:**
- Added patterns for `*.png`, `gui_test.py`, `debug_gui.py`, `inspect_*.py`, `comprehensive_gui_test.cjs`, `standalone_verify.cjs`, `verify_updates.cjs`, `venv/`, `playwright-report/`, `test-results/`, `.autonomous/`

---

## Key Files for New Developers

Start by reading these files in this order:

1. **`types.ts`** - Data model (Domain, SSLInfo, Settings, etc.)
2. **`App.tsx`** - All state management, main UI composition (~520 lines)
3. **`hooks/useMonitoring.ts`** - Worker lifecycle, check orchestration
4. **`services/domainService.ts`** - Core domain check logic with API fallback
5. **`services/monitoring.worker.ts`** - Web Worker background processing
6. **`server/proxy.ts`** - Local dev backend (all 5 endpoints in one file)
7. **`api/whois.ts`** - Most incomplete production feature
8. **`components/AuthProvider.tsx`** - Session management
9. **`utils/storage.ts`** - All localStorage persistence
10. **`lib/config.ts`** - Centralized configuration constants

---

## Build Sizes (Last Known)

### DomainPulse App
```
dist/index.html                   1.50 kB
dist/assets/icons-*.js            26.03 kB  (Lucide icons)
dist/assets/index-*.js           252.54 kB  (Main bundle)
dist/assets/charts-*.js          368.45 kB  (Recharts)
```

### Marketing Site
```
dist-site/index.html              1.50 kB
dist-site/assets/vendor-*.js       3.89 kB
dist-site/assets/icons-*.js       26.03 kB
dist-site/assets/index-*.js      618.26 kB
```

---

## Previous Code Review Summary

Two code reviews were performed. All fixes from those reviews are already merged into the current branch:

- PBKDF2 password hashing (replaced SHA-256)
- URL validation and sanitization
- CORS configuration (configurable origins)
- Bundle code splitting (manual chunks)
- Memory leak fix (bounded previousStatuses map, useRef for stable intervals)
- TypeScript strict mode enabled
- ESLint configured with custom formatter
- Vitest infrastructure set up
- Centralized config created
- Error logging added to catch blocks
- Unused mock functions removed

See `CODE_REVIEW_COMPLETE.md` and `CODE_REVIEW_FIXES.md` for full details of those changes.

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2.4 |
| Build | Vite | 6.2.0 |
| Language | TypeScript | 5.8.2 |
| Styling | Tailwind CSS | 4.1.18 |
| Charts | Recharts | 3.7.0 |
| Icons | Lucide React | 0.564.0 |
| Markdown | Marked | 17.0.2 |
| Server | Express | 4.21.0 |
| Unit Tests | Vitest | 1.3.1 |
| E2E Tests | Playwright | 1.58.2 |
| Deployment | Vercel | Serverless functions |
