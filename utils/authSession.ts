/**
 * Single source of truth for reading the client auth-session token.
 *
 * The session is written by `AuthProvider` to **sessionStorage** (key
 * `domainpulse_auth_session`) — NOT localStorage. Every service/hook that
 * attaches a `Bearer` token to an `/api/*` call MUST read it through here so
 * the storage choice can never drift again.
 *
 * Why this exists: services used to keep their own `getStoredToken()` copies
 * that read `localStorage`, while the token actually lives in `sessionStorage`.
 * The read silently returned `null`, so no `Authorization` header was sent,
 * `/api/check` answered `401`, and an otherwise **ALIVE** domain surfaced as
 * **Error** when added/re-checked. See AGENTS.md §5.
 *
 * Safe in non-DOM contexts: Web Workers have no `sessionStorage`, so this
 * returns `null` there and the caller passes the token via
 * `ServiceConfig.authToken` (read on the main thread) instead.
 */
export const AUTH_SESSION_KEY = 'domainpulse_auth_session';

interface StoredSession {
  token?: string;
  expiresAt?: number;
}

/**
 * Return the current, non-expired session token, or `null` if there is no
 * valid session (or storage is unavailable). Never throws.
 */
export const getSessionToken = (): string | null => {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
};
