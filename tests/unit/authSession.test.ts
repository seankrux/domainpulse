import { describe, it, expect, beforeEach } from 'vitest';
import { getSessionToken, AUTH_SESSION_KEY } from '../../utils/authSession';

/**
 * Locks the token single-source-of-truth: the session is written by
 * AuthProvider to sessionStorage, so getSessionToken() must read sessionStorage
 * (never localStorage). Reading the wrong store silently dropped the Bearer
 * token → /api/check 401 → an ALIVE domain showed as Error. See AGENTS.md §5.
 */
describe('getSessionToken (auth token single source of truth)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns null when there is no session', () => {
    expect(getSessionToken()).toBeNull();
  });

  it('returns the token from a valid sessionStorage session', () => {
    sessionStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ token: 'tok-123', expiresAt: Date.now() + 60_000 })
    );
    expect(getSessionToken()).toBe('tok-123');
  });

  it('returns null when the session is expired', () => {
    sessionStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ token: 'tok-123', expiresAt: Date.now() - 1 })
    );
    expect(getSessionToken()).toBeNull();
  });

  it('returns null for malformed JSON instead of throwing', () => {
    sessionStorage.setItem(AUTH_SESSION_KEY, 'not-json{');
    expect(getSessionToken()).toBeNull();
  });

  it('does NOT read the token from localStorage (the original bug)', () => {
    // Token only in localStorage, sessionStorage empty → must be treated as
    // logged out, because AuthProvider never writes to localStorage.
    localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ token: 'wrong-store', expiresAt: Date.now() + 60_000 })
    );
    expect(getSessionToken()).toBeNull();
  });
});
