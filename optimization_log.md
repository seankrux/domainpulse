# Optimization & Lessons Log

This file acts as the long-term memory for the Gemini agent. It is used to record inefficiencies, successful shortcuts, and "fast paths" for common tasks.

## Protocol
- **Read:** At the start of every complex task, read this file to find existing optimizations.
- **Write:** After completing a task, record what went wrong (inefficiency) and how to solve it faster next time (optimization).

## Learned Optimizations
- [LINTING]: ESLint scanning `venv` and `node_modules` caused 900+ false positives -> Created `.eslintignore` to scope linting to source files only.
- [HOOKS]: Stale data in `HistoryChart` -> Swapped length-based dependencies for deep object dependencies in `useMemo`.
- [TESTING]: Dynamic UI states (e.g. "Checking..." -> "Alive") cause flaky tests if asserted statically. -> Use `textContent()` to read actual state and branch logic in tests for robustness.
- [ARCHITECTURE]: Prop Destructuring Bug -> Always double-check component destructuring in `DomainTable.tsx` after adding props to the interface to ensure they are actually passed to handlers.
- [AUTH]: Persistence Bug -> `AuthProvider.tsx` previously required a `PASSWORD_HASH_KEY` that was never set, causing logouts on refresh. Simplified to only check for `AUTH_TOKEN_KEY`.

