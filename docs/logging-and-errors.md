# Logging & Error Handling

The API layer uses a small, dependency-free observability stack:

- `api/_utils/logger.ts` — structured JSON logging with redaction.
- `api/_utils/errors.ts` — a consistent error taxonomy.
- `api/_utils/observability.ts` — `withObservability`, a per-request wrapper.

## Structured logging

Every log line is a single JSON object written to `stdout` (debug/info) or
`stderr` (warn/error), so aggregators (Vercel, Datadog, etc.) parse it without
regexes. The envelope always includes:

| Field | Meaning |
|-------|---------|
| `timestamp` | ISO-8601 UTC |
| `level` | `debug` \| `info` \| `warn` \| `error` |
| `service` | `domainpulse-api` |
| `env` | `VERCEL_ENV` \| `NODE_ENV` \| `development` |
| `version` | `APP_VERSION` \| `VERCEL_GIT_COMMIT_SHA` \| package version \| `dev` |
| `requestId` | correlation id (bound via `createLogger`) |
| `operation` | endpoint name (e.g. `check`, `dns`) |
| `message` | short event name (e.g. `request.start`) |
| …meta | any extra structured fields passed to the call |

Usage:

```ts
import { createLogger } from './_utils/logger.js';

const logger = createLogger({ operation: 'check', requestId });
logger.info('request.start', { method: 'GET', path: '/api/check' });
logger.child({ domain: 'example.com' }).warn('slow.lookup', { durationMs: 4200 });
```

### Redaction (secrets & PII)

`redact()` deep-clones values before serialisation and:

- replaces values whose **key** matches
  `authorization|password|secret|token|cookie|session|api[-_]?key|jwt|salt`
  with `[REDACTED]` (case-insensitive, at any depth);
- masks email addresses in string values (`jane.doe@x.com` → `j***@x.com`);
- guards against circular references (`[Circular]`) and excessive depth
  (`[Truncated]`).

Logging **never throws**: stream-write and serialisation failures are swallowed
so a logging bug can never crash a request.

### Log level

`LOG_LEVEL` (`debug|info|warn|error`) controls verbosity. Default: `info` in
production, `debug` elsewhere.

## Error taxonomy

`AppError` tags each deliberate error with an `ErrorCategory`, which maps
deterministically to an HTTP status and a stable `code` in the response body:

| Category | Status | `code` |
|----------|--------|--------|
| `validation` | 400 | `validation` |
| `auth` | 401 | `auth` |
| `permission` | 403 | `permission` |
| `conflict` | 409 | `conflict` |
| `timeout` | 504 | `timeout` |
| `dependency` | 502 | `dependency` |
| `internal` | 500 | `internal` |

Client error body shape:

```json
{ "error": "Domain is required", "code": "validation", "requestId": "…" }
```

- **Message exposure** — validation/auth/permission/conflict messages are safe
  to return. Dependency/timeout/internal messages are replaced with a generic
  default so internals never leak; the raw message stays on the `AppError` for
  logging only.
- **`categorizeError()`** normalises arbitrary throwables: abort/timeout →
  `timeout`, common network failures (`ENOTFOUND`, `ECONNREFUSED`, `fetch
  failed`, …) → `dependency`, everything else → `internal`.

Convenience constructors: `validationError`, `authError`, `permissionError`,
`dependencyError`, `timeoutError`, `internalError`.

## `withObservability`

Wraps a Vercel handler so that, **without changing existing response bodies or
status codes**, each request:

- gets a correlation id (reused from an inbound `x-request-id` header or freshly
  generated) echoed back in the `x-request-id` response header;
- emits `request.start` and `request.finish` logs (method, path, status,
  `durationMs`);
- routes any **uncaught** throw through the error taxonomy into a consistent
  JSON error response (previously an uncaught throw produced an opaque platform
  500 with no log line).

```ts
async function handler(req, res) { /* … */ }
export default withObservability('check', handler);
```

The dev proxy (`server/proxy.ts`) has an equivalent Express middleware so local
and production logs look the same.

## Invariant

`withObservability` is **additive**: it must never alter a handler's existing
response contract. The enrichment endpoints intentionally return `200` with an
`{ error }` body on lookup failure (so a failed enrichment never downgrades
liveness — `AGENTS.md` §1/§6); the wrapper does not change that. Only *uncaught*
throws are converted to taxonomy responses.
