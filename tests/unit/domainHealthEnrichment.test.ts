import { describe, it, expect, vi } from 'vitest';
import { computeDomainHealth } from '../../utils/domainHealth';
import { SSLStatus } from '../../types';

vi.mock('../../api/_utils/publicDns.js', () => ({
  publicResolver: () => ({
    resolve4: async () => ['93.184.215.14'],
    resolve6: async () => ['2606:2800:220:1:248:1893:25c8:1946'],
    resolveNs: async () => ['ns1.example.test'],
    resolveCname: async () => [],
    resolveMx: async () => [{ priority: 10, exchange: 'mail.example.test' }],
    resolveCaa: async () => [{ critical: 0, issue: 'ca.example.test' }],
    resolveSoa: async () => ({ nsname: 'ns1.example.test', hostmaster: 'hostmaster.example.test', serial: 1, refresh: 3600, retry: 600, expire: 86400, minttl: 300 }),
    resolveTxt: async (host: string) => host.startsWith('_dmarc.')
      ? [['v=DMARC1; p=reject']]
      : host.startsWith('google._domainkey.')
        ? [['v=DKIM1; p=cHVibGljLWtleQ==']]
        : host.includes('._domainkey.') ? [] : [['v=spf1 -all']],
  }),
}));

vi.mock('rdapper', () => ({
  lookupDomain: vi.fn().mockResolvedValue({
    ok: true,
    record: {
      isRegistered: true,
      creationDate: '2000-01-01T00:00:00.000Z',
      expirationDate: '2030-01-01T00:00:00.000Z',
      registrar: { name: 'Fixture Registrar' },
      nameservers: [{ host: 'ns1.example.test' }],
    },
  }),
}));

describe('computeDomainHealth', () => {
  it('returns undefined when no enrichment signals exist', () => {
    expect(computeDomainHealth({})).toBeUndefined();
  });

  it('grades A when email, headers, SSL, DNS, and canonical are strong', () => {
    const health = computeDomainHealth({
      emailAuth: {
        grade: 'A',
        spf: { present: true },
        dkim: { present: true },
        dmarc: { present: true, policy: 'reject' },
        issues: [],
      },
      securityHeaders: {
        grade: 'A',
        score: 100,
        maxScore: 100,
        headers: [],
        issues: [],
      },
      ssl: { status: SSLStatus.Valid, daysUntilExpiry: 90 },
      dns: { a: ['1.2.3.4'], aaaa: ['::1'], ns: ['ns1.example.com'], caa: [{ critical: 0, raw: 'issue=letsencrypt.org' }] },
      canonical: {
        status: 'correct',
        variants: [],
        issues: [],
        httpsEnforced: true,
        wwwConsistent: true,
      },
    });

    expect(health).toBeDefined();
    expect(health!.grade).toBe('A');
    expect(health!.factors.length).toBe(5);
  });

  it('grades poorly when SSL is expired and email is missing', () => {
    const health = computeDomainHealth({
      emailAuth: {
        grade: 'F',
        spf: { present: false },
        dkim: { present: false },
        dmarc: { present: false },
        issues: ['No SPF'],
      },
      ssl: { status: SSLStatus.Expired, daysUntilExpiry: -10 },
    });

    expect(health).toBeDefined();
    expect(['D', 'F']).toContain(health!.grade);
  });
});

describe('emailAuthLookup grading helpers', () => {
  it('grades deterministic public DNS records and returns the structured result', async () => {
    const { getEmailAuthInfo } = await import('../../api/_utils/emailAuthLookup');
    const result = await getEmailAuthInfo('example.com');
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('spf');
    expect(result).toHaveProperty('dkim');
    expect(result).toHaveProperty('dmarc');
    expect(result.grade).toBe('A');
    expect(result.spf.present).toBe(true);
    expect(result.dkim.selectors).toEqual(['google']);
    expect(result.dmarc.policy).toBe('reject');
    expect(result.issues).toEqual([]);
  });
});

describe('securityHeadersLookup', () => {
  it('returns F with issues when SSRF blocks the target', async () => {
    const { getSecurityHeadersInfo } = await import('../../api/_utils/securityHeadersLookup');
    const result = await getSecurityHeadersInfo('127.0.0.1');
    expect(result.grade).toBe('F');
    expect(result.score).toBe(0);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('dnsLookup expanded records', () => {
  it('includes aaaa/caa/soa fields on the result object', async () => {
    const { getDNSInfo } = await import('../../api/_utils/dnsLookup');
    const result = await getDNSInfo('example.com');
    expect(result).toHaveProperty('a');
    expect(result).toHaveProperty('aaaa');
    expect(result).toHaveProperty('caa');
    expect(Array.isArray(result.aaaa)).toBe(true);
    expect(Array.isArray(result.caa)).toBe(true);
    expect(result.soa).toBeDefined();
    expect(result.soa?.nsname).toBeTruthy();
  });
});

describe('whoisLookup RDAP preference', () => {
  it('maps a successful RDAP record without a network dependency', async () => {
    const { getWhoisInfo } = await import('../../api/_utils/whoisLookup');
    const result = await getWhoisInfo('example.com');
    expect(result.error).toBeUndefined();
    expect(result.source).toBe('rdap');
    expect(result.registrar).toBe('Fixture Registrar');
    expect(result.expiryDate).toBe('2030-01-01T00:00:00.000Z');
    expect(result.nameServers).toEqual(['ns1.example.test']);
  });
});
