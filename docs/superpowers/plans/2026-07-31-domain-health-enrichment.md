# Domain Health Enrichment Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Ship free advanced domain intelligence — email auth, security headers, richer DNS, RDAP WHOIS.

**Architecture:** New lookup utils in `api/_utils`, enrichment slots in `checkDomainWithSSL`, detail-modal UI + health badge. Liveness unchanged.

**Tech Stack:** Node dns, existing SSRF guard, `rdapper`, `ssl-checker`, React detail modal.

## Global Constraints

- Enrichment only — `Promise.allSettled`, soft timeout, no Alive→Error
- SSRF on all outbound HTTP/TLS
- Prod/dev share utils; proxy + vercel.json for every new `/api/*` route
- Free only — no paid APIs

---

### Task 1: Expand DNS lookup
- [x] Add AAAA/CAA/SOA to `dnsLookup.ts` + `DNSInfo` type
- [x] Unit test new fields
- [x] Show in DomainDetailModal DNS section

### Task 2: Email auth enrichment
- [x] `emailAuthLookup.ts` — SPF/DMARC parse, DKIM selector probe, grade
- [x] `/api/email-auth` + proxy + service
- [x] Wire into domainService; UI section + badge

### Task 3: Security headers
- [x] `securityHeadersLookup.ts` via SSRF-safe fetch
- [x] `/api/security-headers` + proxy + service
- [x] UI section with grade

### Task 4: RDAP + SSL upgrade
- [x] Prefer `rdapper` in `whoisLookup.ts`, fall back to existing parsers
- [x] Enrich SSL with protocol/cipher when safe
- [x] Tests for mapping

### Task 5: Health score + ship
- [x] Compute health from email+headers+dns basics
- [x] Detail modal Health summary; table column
- [ ] type-check, unit, GUI tests; commit; PR
