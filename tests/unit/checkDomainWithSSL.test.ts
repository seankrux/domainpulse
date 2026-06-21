import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkDomainWithSSL } from '../../services/domainService';
import { DomainStatus, SSLStatus } from '../../types';

/**
 * Liveness contract for checkDomainWithSSL (AGENTS.md §1):
 *  - Liveness is decided ONLY by the uptime probe (/api/check).
 *  - Enrichment (SSL/expiry/DNS/Tech) may fail OR hang and must degrade to safe
 *    defaults — it can NEVER turn an ALIVE domain into Error.
 *  - Error is reachable only when the uptime probe itself fails (auth/network).
 */

type Body = Record<string, unknown>;
const resp = (status: number, body: Body) =>
  Promise.resolve({
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as unknown as Response);

const ALIVE = { status: 'ALIVE', statusCode: 200, latency: 7 };
const cfg = { proxyUrl: 'http://localhost:3001', timeout: 5000 };

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('checkDomainWithSSL — liveness invariant', () => {
  it('stays ALIVE when every enrichment call fails', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/check')) return resp(200, ALIVE);
      return Promise.reject(new Error('enrichment network down'));
    });

    const r = await checkDomainWithSSL('example.com', cfg);

    expect(r.status).toBe(DomainStatus.Alive);
    expect(r.statusCode).toBe(200);
    expect(r.ssl.status).toBe(SSLStatus.Unknown);
    expect(r.expiry).toBeUndefined();
  });

  it('stays ALIVE when enrichment hangs past the timeout (no false Error)', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/check')) return resp(200, ALIVE);
      return new Promise<Response>(() => {}); // never resolves
    });

    const r = await checkDomainWithSSL('example.com', { ...cfg, timeout: 80 });

    expect(r.status).toBe(DomainStatus.Alive);
    expect(r.ssl.status).toBe(SSLStatus.Unknown);
  });

  it('reports DOWN (not Error) when the probe says DOWN', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/check')) return resp(200, { status: 'DOWN', statusCode: 503, latency: 12 });
      return Promise.reject(new Error('enrichment skipped'));
    });

    const r = await checkDomainWithSSL('example.com', cfg);
    expect(r.status).toBe(DomainStatus.Down);
    expect(r.statusCode).toBe(503);
  });

  it('throws Unauthorized only when the uptime probe is 401', async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/check')) return resp(401, { error: 'Unauthorized' });
      return Promise.reject(new Error('unused'));
    });

    await expect(checkDomainWithSSL('example.com', cfg)).rejects.toThrow('Unauthorized');
  });

  it('sends the Bearer token read from sessionStorage when none is passed', async () => {
    sessionStorage.setItem(
      'domainpulse_auth_session',
      JSON.stringify({ token: 'sess-tok', expiresAt: Date.now() + 60_000 })
    );
    const seen: Array<string | undefined> = [];
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/check')) {
        const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
        seen.push(auth);
        return resp(200, ALIVE);
      }
      return Promise.reject(new Error('enrichment skipped'));
    });

    // No authToken in config → must fall back to the sessionStorage token.
    const r = await checkDomainWithSSL('example.com', { proxyUrl: cfg.proxyUrl, timeout: 5000 });
    expect(r.status).toBe(DomainStatus.Alive);
    expect(seen[0]).toBe('Bearer sess-tok');
  });
});
