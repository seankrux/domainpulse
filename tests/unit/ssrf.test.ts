import { describe, it, expect } from 'vitest';
import { isBlockedHost, validateOutboundUrl, isBlockedIp, validateOutboundUrlResolved, isReachableStatus, toCheckResult } from '../../api/_utils/ssrfGuard';

describe('ssrfGuard.toCheckResult (shared liveness mapping)', () => {
  it('maps a reachable probe to ALIVE with its status/latency', () => {
    expect(toCheckResult({ ok: true, status: 200, latency: 42 })).toEqual({
      status: 'ALIVE', statusCode: 200, latency: 42,
    });
  });

  it('maps an unreachable probe to DOWN', () => {
    expect(toCheckResult({ ok: false, status: 503, latency: 10 })).toEqual({
      status: 'DOWN', statusCode: 503, latency: 10,
    });
  });

  it('forwards a transport error message when present', () => {
    expect(toCheckResult({ ok: false, status: 0, latency: 5, error: 'timeout' })).toEqual({
      status: 'DOWN', statusCode: 0, latency: 5, message: 'timeout',
    });
  });
});

describe('ssrfGuard.isReachableStatus (liveness contract)', () => {
  it('treats any answered status < 500 as up (server reachable)', () => {
    // 2xx/3xx are obviously up; 401/403/405/429 still prove the host responded.
    for (const code of [200, 204, 301, 302, 401, 403, 404, 405, 429, 451]) {
      expect(isReachableStatus(code), String(code)).toBe(true);
    }
  });

  it('treats 5xx and no-response as down', () => {
    for (const code of [0, 500, 502, 503, 504]) {
      expect(isReachableStatus(code), String(code)).toBe(false);
    }
  });
});

describe('ssrfGuard.isBlockedIp', () => {
  it('blocks private/reserved IPv4, IPv6, and IPv4-mapped IPv6', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '169.254.169.254', '100.64.0.1', '::1', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1']) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });
  it('allows public IPs', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:4700::1111']) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });
});

describe('ssrfGuard.validateOutboundUrlResolved (DNS rebinding)', () => {
  it('blocks a hostname that resolves to loopback', async () => {
    // localhost resolves to 127.0.0.1 / ::1 → must be blocked after resolution
    const r = await validateOutboundUrlResolved('http://localhost/');
    expect(r.ok).toBe(false);
  });
  it('allows a real public host', async () => {
    const r = await validateOutboundUrlResolved('https://github.com/');
    expect(r.ok).toBe(true);
  });
});

describe('ssrfGuard.isBlockedHost', () => {
  it('blocks loopback, private, link-local/metadata, and internal TLDs', () => {
    for (const h of [
      'localhost', '127.0.0.1', '127.5.5.5', '0.0.0.0', '10.0.0.5', '192.168.1.1',
      '172.16.0.1', '172.31.255.255', '169.254.169.254', '100.100.0.1', '::1',
      'app.internal', 'db.local', 'metadata.google.internal',
    ]) {
      expect(isBlockedHost(h), h).toBe(true);
    }
  });

  it('allows real public hosts', () => {
    for (const h of ['github.com', 'example.com', '8.8.8.8', '1.1.1.1', '172.32.0.1']) {
      expect(isBlockedHost(h), h).toBe(false);
    }
  });
});

describe('ssrfGuard.validateOutboundUrl', () => {
  it('rejects non-http schemes and private targets', () => {
    expect(validateOutboundUrl('file:///etc/passwd').ok).toBe(false);
    expect(validateOutboundUrl('ftp://example.com').ok).toBe(false);
    expect(validateOutboundUrl('http://localhost:3001/health').ok).toBe(false);
    expect(validateOutboundUrl('http://169.254.169.254/latest/meta-data/').ok).toBe(false);
    expect(validateOutboundUrl('not a url').ok).toBe(false);
  });

  it('allows valid public https URLs', () => {
    expect(validateOutboundUrl('https://github.com').ok).toBe(true);
    expect(validateOutboundUrl('http://example.com/path').ok).toBe(true);
  });
});
