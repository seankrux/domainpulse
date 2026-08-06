# Runbook

Operational guide for running, debugging, and deploying DomainPulse.

## Run locally

```bash
npm ci --legacy-peer-deps      # install (CI parity)
npm run dev:all                # dashboard :3000 + Express proxy :3001
npm run dev                    # marketing site :3002 (separate terminal)
```

Health check for the dev proxy: `curl http://localhost:3001/health`.

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `VITE_PASSWORD_HASH` | No (enables auth) | PBKDF2 `hash:salt`; when unset the app runs public/login-less |
| `JWT_SECRET` | Only if auth enabled | Signs session tokens in production |
| `ALLOWED_ORIGINS` | No | Extra CORS origins (comma-separated) |
| `GOOGLE_PLACES_API_KEY` | No | Enables GMB checks; without it GMB degrades to "Unknown" |
| `LOG_LEVEL` | No | `debug\|info\|warn\|error` (default: `info` in prod, `debug` else) |
| `APP_VERSION` | No | Overrides the `version` field in logs |

## Observability

- Logs are structured JSON (see [logging-and-errors.md](./logging-and-errors.md)).
- Every response carries an `x-request-id`. To trace a request end-to-end, grep
  logs for that id:

  ```bash
  grep '"requestId":"<id>"' <log-source>
  ```

- Send your own correlation id through the stack with a request header:
  `curl -H 'x-request-id: my-trace' .../api/check?url=example.com`.

## Common incidents

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Domain shows **Error** though it's up | Auth/token or a whole-check timeout | Confirm `verifyAuth` allows the request (`AGENTS.md` §7); check `check` logs for `request.error`. Enrichment failures must NOT cause this (`AGENTS.md` §1). |
| Every domain 401 | `VITE_PASSWORD_HASH` set but client sends no token | Either unset it (public mode) or restore a real login (`AGENTS.md` §7). |
| `429 Rate limit exceeded` | Too many requests in the window | Back off; limits in `lib/config.ts` (`rateLimit`). |
| `400 Blocked` on a real domain | SSRF guard blocked host / non-resolving | Expected for private/unresolvable hosts (`AGENTS.md` known gap #2). |
| Site build breaks but CI was green | Site build path regressed | CI now runs `npm run build` (site) in `automated-tests.yml`; reproduce with `npm run build`. |

## Deploy

- Production deploys on push to `main`/`master` via
  `.github/workflows/deploy.yml` (Vercel `--prod`).
- Rollback: revert the offending commit and push, or promote a previous
  deployment in the Vercel dashboard.

## Verify a change before shipping

```bash
npm run type-check
npm run lint
npm test -- --run
npm run build:all
```
