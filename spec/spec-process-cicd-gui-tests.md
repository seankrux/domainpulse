---
title: CI/CD Workflow Specification - GUI Tests
version: 1.0
date_created: 2026-08-23
last_updated: 2026-08-23
owner: seankrux
tags: [process, cicd, github-actions, domainpulse, playwright]
---

## Workflow Overview

**Purpose**: Build the app and run the Playwright GUI suite.
**Trigger Events**: Push to `main` or `feature/*`; PR to `main`.
**Target Environments**: Ephemeral Ubuntu CI.

## Jobs & Dependencies

| Job Name | Purpose | Dependencies | Execution Context |
|---|---|---|---|
| test | Build + GUI Playwright | none | ubuntu-latest, 60 min |

## Requirements Matrix

| ID | Requirement | Priority | Acceptance Criteria |
|---|---|---|---|
| REQ-001 | Build before GUI tests | High | `npm run build:app` then `test:gui` |
| REQ-002 | Report retained | Medium | artifact 30 days |

## Input/Output Contracts

```yaml
VITE_PROXY_URL: http://localhost:3001
playwright-report: file
```

## Execution Constraints

- 60 minute timeout
- Node 20 + Chromium

## Error Handling Strategy

| Error Type | Response | Recovery |
|---|---|---|
| GUI failure | Job fails; report uploaded | Inspect artifact |

## Validation Criteria

- VLD-001: Feature-branch pushes are included
- VLD-002: Report upload uses `if: always()`

## Change Management

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-08-23 | Initial specification | fleet audit |
