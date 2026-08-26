---
title: CI/CD Workflow Specification - Stale
version: 1.0
date_created: 2026-08-23
last_updated: 2026-08-23
owner: seankrux
tags: [process, cicd, github-actions, stale]
---

## Workflow Overview

**Purpose**: Weekly stale marking of inactive issues and PRs.
**Trigger Events**: Sunday 03:00 UTC; manual dispatch.

## Jobs & Dependencies

| Job Name | Purpose | Dependencies | Execution Context |
|---|---|---|---|
| stale | Label inactive issues/PRs | none | ubuntu-latest |

## Secrets & Variables

GITHUB_TOKEN only.

## Change Management

| Version | Date | Changes | Author |
|---|---|---|---|
| 1.0 | 2026-08-23 | Initial specification | fleet audit |
