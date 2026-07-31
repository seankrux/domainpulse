# Domain Health Enrichment — Design

**Date:** 2026-07-31  
**Status:** Approved  
**Approach:** Hybrid (build email auth + headers + DNS expand; integrate `rdapper` + richer SSL)

## Goal

Make DomainPulse a superior free domain intelligence dashboard by adding email authentication health, richer DNS, security header grading, and RDAP-backed registration data — all as enrichment (never affecting Alive/Down liveness).

## Scope

1. DNS: AAAA, CAA, SOA (+ existing A/MX/NS/TXT/CNAME)
2. Email auth: SPF / DKIM / DMARC parse + A–F grade
3. Security headers: HSTS, CSP, XFO, XCTO, Referrer-Policy, Permissions-Policy + grade
4. RDAP via `rdapper` with WHOIS fallback
5. Domain Health score in detail modal (+ optional table badge)
6. Optional SSL enrichment: protocol/cipher/fingerprint via `ssl-checker` (SSRF-aware wrapper)

## Out of scope

Subdomain CT enumeration, DNSBL, full DNSSEC crypto validation, BIMI/MTA-STS (follow-ups).

## Invariants

- Enrichment via `Promise.allSettled` + soft timeout; never flips Alive→Error (AGENTS.md §1, §6)
- Outbound HTTPS through SSRF guard
- Shared utils in `api/_utils/*`; Vercel + proxy both call them
- Auth opt-in unchanged

## Data model

- `DNSInfo` gains `aaaa?`, `caa?`, `soa?`
- `EmailAuthInfo` { grade, spf, dkim, dmarc, issues[] }
- `SecurityHeadersInfo` { grade, score, headers[], issues[] }
- `Domain.health?` computed client-side or server-side summary grade
- `SSLInfo` optionally gains protocol, cipher, fingerprint

## UI

Domain Detail Modal sections: Email Authentication, Security Headers, expanded DNS, Health summary. Table: Health badge when present.
