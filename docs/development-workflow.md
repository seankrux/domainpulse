# Development Workflow

## Prerequisites

- Node 20+ (repo pins 22 via `.nvmrc`; `engines` requires >=20)
- npm

## Setup

```bash
npm ci --legacy-peer-deps
```

`--legacy-peer-deps` matches CI (`.github/workflows/ci.yml`) and the Cursor
Cloud startup script; use it for manual installs too.

## Day-to-day

| Task | Command |
|------|---------|
| Dashboard + proxy | `npm run dev:all` (`:3000` + `:3001`) |
| Marketing site | `npm run dev` (`:3002`) |
| Type check | `npm run type-check` |
| Lint | `npm run lint` (`lint:fix` to autofix) |
| Unit tests | `npm test -- --run` (Vitest, jsdom) |
| GUI tests | `npm run test:gui` (needs `npx playwright install chromium`) |
| Build both apps | `npm run build:all` |

## Testing conventions

- Unit tests live in `tests/unit/**` (`*.test.ts[x]`) and run under Vitest.
- Cover **negative paths** (invalid input, timeouts, network failures,
  redaction, circular refs), not just the happy path.
- Cross-cutting utilities (`api/_utils/*`) should have dedicated unit tests
  (see `logger.test.ts`, `errors.test.ts`, `observability.test.ts`).
- GUI/E2E specs live in `tests/*.spec.ts` (Playwright) and are excluded from the
  Vitest run.

## Coding standards

- Keep imports at the top of the module (no inline imports).
- Use exhaustive `switch` over unions/enums with a `never` default.
- API endpoints share one implementation per lookup in `api/_utils/*Lookup.ts`;
  never reimplement a lookup inline in an endpoint or the proxy.
- Wrap new API endpoints with `withObservability('<operation>', handler)` and
  raise typed `AppError`s instead of ad-hoc `res.status(...)` for error paths
  where practical. See [logging-and-errors.md](./logging-and-errors.md).
- Respect the invariants in `AGENTS.md` (liveness vs enrichment, SSRF guard,
  status badge rules, auth opt-in, token storage). Update `AGENTS.md` in the
  same PR if you intentionally change one.

## Pull requests

Summarize **what/why**, call out **risks**, include **test evidence**, and note
a **rollback plan**. Prefer small, focused commits. Run type-check, lint, unit
tests, and build before opening the PR.

## Architecture Decision Records

Significant, hard-to-reverse decisions are recorded under `docs/adr/`. Add a new
numbered ADR when you make one.
