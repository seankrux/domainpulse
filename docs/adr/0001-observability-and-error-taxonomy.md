# ADR 0001: API observability and error taxonomy

- **Status:** Accepted
- **Date:** 2026-08-06
- **Context issue:** #3 (enterprise engineering baseline)

## Context

The API layer (`api/*.ts` + `server/proxy.ts`) had:

- no structured logging — nothing to correlate a request across the pipeline,
  no durations, and any `console` use is constrained by the repo's `no-console`
  lint rule;
- ad-hoc error handling — each endpoint hand-rolled `res.status(...).json(...)`
  with inconsistent shapes, and an *uncaught* throw produced an opaque platform
  500 with no log line and a risk of leaking internal detail.

We wanted an enterprise-grade baseline (structured logs with redaction, a
consistent error taxonomy, centralized handling) **without** regressing the
behavioral invariants documented in `AGENTS.md` — especially that enrichment
failures must never change liveness, and that existing response contracts the
frontend depends on must not change.

## Decision

Add three small, dependency-free utilities:

1. `api/_utils/logger.ts` — structured JSON logger. Writes one JSON object per
   line to `stdout`/`stderr` (avoids `console`, the correct sink for structured
   logs), with a fixed envelope (timestamp, level, service, env, version,
   requestId, operation, message). Redacts secret-like keys and masks emails;
   never throws.
2. `api/_utils/errors.ts` — `AppError` + `ErrorCategory`
   (validation/auth/permission/dependency/timeout/conflict/internal) with a
   deterministic category→status map and `toErrorResponse()` that hides
   non-exposable detail while keeping the raw message for logs.
3. `api/_utils/observability.ts` — `withObservability(operation, handler)`
   wraps each endpoint additively: correlation id (`x-request-id`),
   start/finish logs with duration, and centralized taxonomy handling for
   *uncaught* throws only. The dev proxy gets an equivalent middleware for
   prod/dev parity.

## Consequences

- **Positive:** every request is traceable via `x-request-id`; logs are
  machine-parseable; error responses are consistent (`{ error, code, requestId }`)
  and never leak internals; an uncaught throw is now logged and returns a mapped
  status instead of an opaque 500.
- **Neutral / preserved:** existing happy-path responses and the enrichment
  endpoints' `200 { error }` degradation are unchanged; `withObservability`
  only takes over on uncaught throws. Liveness/enrichment invariants (`AGENTS.md`
  §1/§6) are untouched.
- **Cost:** a new `x-request-id` response header (additive) and a modest amount
  of log volume, tunable via `LOG_LEVEL`.

## Alternatives considered

- A logging library (pino/winston): rejected to avoid adding a dependency for a
  small, well-scoped need and to keep bundle/runtime lean.
- Rewriting each endpoint's error handling inline: rejected as more invasive and
  higher-risk against the response-contract invariants; the wrapper is additive.
