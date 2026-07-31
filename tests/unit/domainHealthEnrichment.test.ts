import { describe, it, expect, vi } from 'vitest';
import { computeDomainHealth } from '../../utils/domainHealth';
import { SSLStatus } from '../../types';

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
  it('exports getEmailAuthInfo and returns a structured result shape', async () => {
    const { getEmailAuthInfo } = await import('../../api/_utils/emailAuthLookup');
    // Use a domain with known public DNS; network may be flaky — assert shape only when it resolves.
    const result = await getEmailAuthInfo('example.com');
    expect(result).toHaveProperty('grade');
    expect(result).toHaveProperty('spf');
    expect(result).toHaveProperty('dkim');
    expect(result).toHaveProperty('dmarc');
    expect(Array.isArray(result.issues)).toBe(true);
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
    // example.com has SOA
    expect(result.soa).toBeDefined();
    expect(result.soa?.nsname).toBeTruthy();
  });
});

describe('whoisLookup RDAP preference', () => {
  it('maps RDAP-backed example.com without throwing', async () => {
    const { getWhoisInfo } = await import('../../api/_utils/whoisLookup');
    const result = await getWhoisInfo('example.com');
    // Prefer RDAP; either source is fine as long as we get registration data.
    expect(result.error).toBeUndefined();
    expect(result.registrar || result.expiryDate || result.nameServers).toBeTruthy();
  });
});

// Keep vi import used if we add mocks later
void vi;
