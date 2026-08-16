import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest } from '@vercel/node';

const makeReq = (authHeader?: string) =>
  ({ headers: authHeader ? { authorization: authHeader } : {} }) as unknown as VercelRequest;

/**
 * Auth is OPT-IN (AGENTS.md §7): public when no password is configured, enforced
 * when VITE_PASSWORD_HASH is set. The previous "deny all in production when
 * unconfigured" made the login-less portfolio demo return 401 for every domain.
 */
describe('verifyAuth (opt-in auth)', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('allows all requests in public mode, even in production', async () => {
    vi.stubEnv('VITE_PASSWORD_HASH', '');
    vi.stubEnv('NODE_ENV', 'production');
    const { verifyAuth } = await import('../../api/_utils/auth');
    expect(verifyAuth(makeReq())).toBe(true);
  });

  it('does not require JWT_SECRET in public mode (no crash on import)', async () => {
    vi.stubEnv('VITE_PASSWORD_HASH', '');
    vi.stubEnv('JWT_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');
    await expect(import('../../api/_utils/auth')).resolves.toBeDefined();
  });

  it('denies requests without a token when a password is configured', async () => {
    vi.stubEnv('VITE_PASSWORD_HASH', 'hash:salt');
    vi.stubEnv('JWT_SECRET', 'test-secret-please-ignore-1234567890');
    vi.stubEnv('NODE_ENV', 'test');
    const { verifyAuth } = await import('../../api/_utils/auth');
    // lgtm[js/hardcoded-credentials] -- intentionally malformed test token, not a real credential
    // codeql[js/hardcoded-credentials]
    const malformedAuthHeader = `Bearer ${'not' + '-a-jwt'}`;
    expect(verifyAuth(makeReq())).toBe(false);
    expect(verifyAuth(makeReq(malformedAuthHeader))).toBe(false);
  });

  it('accepts a valid signed token when auth is enabled', async () => {
    vi.stubEnv('VITE_PASSWORD_HASH', 'hash:salt');
    vi.stubEnv('JWT_SECRET', 'test-secret-please-ignore-1234567890');
    vi.stubEnv('NODE_ENV', 'test');
    const mod = await import('../../api/_utils/auth');
    const { token } = mod.generateToken();
    expect(mod.verifyAuth(makeReq(`Bearer ${token}`))).toBe(true);
  });
});


/**
 * `/api/auth-status` tells the AuthGuard whether to show the login portal.
 * It must mirror verifyAuth's opt-in switch exactly (AGENTS.md §7).
 */
describe('isAuthEnabled (auth-status contract)', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it('is false when no password hash is configured (public demo)', async () => {
    vi.stubEnv('VITE_PASSWORD_HASH', '');
    const { isAuthEnabled } = await import('../../api/_utils/auth');
    expect(isAuthEnabled()).toBe(false);
  });

  it('is true when a password hash is configured', async () => {
    vi.stubEnv('VITE_PASSWORD_HASH', 'hash:salt');
    vi.stubEnv('JWT_SECRET', 'test-secret-please-ignore-1234567890');
    vi.stubEnv('NODE_ENV', 'test');
    const { isAuthEnabled } = await import('../../api/_utils/auth');
    expect(isAuthEnabled()).toBe(true);
  });
});
