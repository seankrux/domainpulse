import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDNSInfo } from '../../api/_utils/dnsLookup';
import { getEmailAuthInfo } from '../../api/_utils/emailAuthLookup';

beforeEach(() => vi.stubEnv('DOMAINPULSE_WORKER', 'true'));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function dnsFixture(url: string | URL | Request): Promise<Response> {
  const parsed = new URL(String(url));
  const type = parsed.searchParams.get('type');
  const name = parsed.searchParams.get('name') ?? '';
  const txt = name.startsWith('_dmarc.') ? '"v=DMARC1; p=reject"'
    : name.startsWith('selector1._domainkey.') ? '"v=DKIM1; p=QUJD"'
      : name.includes('._domainkey.') ? undefined : '"v=spf1 " "-all"';
  const answers: Record<string, { type: number; data: string }[]> = {
    A: [{ type: 1, data: '93.184.216.34' }],
    AAAA: [{ type: 28, data: '2606:2800:220:1:248:1893:25c8:1946' }],
    MX: [{ type: 15, data: '10 mail.example.test.' }],
    NS: [{ type: 2, data: 'ns.example.test.' }],
    CNAME: [],
    TXT: txt ? [{ type: 16, data: txt }] : [],
    CAA: [{ type: 257, data: '0 issue "letsencrypt.org"' }],
    SOA: [{ type: 6, data: 'ns.example.test. hostmaster.example.test. 20261118 10000 2400 604800 1800' }],
  };
  return Promise.resolve(Response.json({ Status: 0, Answer: answers[type ?? ''] ?? [] }));
}

describe('Cloudflare DNS-over-HTTPS adapter', () => {
  it('preserves A, MX, chunked TXT, CAA and SOA record shapes', async () => {
    vi.stubGlobal('fetch', vi.fn(dnsFixture));
    const records = await getDNSInfo('example.test');
    expect(records.a).toEqual(['93.184.216.34']);
    expect(records.mx).toEqual([{ priority: 10, exchange: 'mail.example.test' }]);
    expect(records.txt).toEqual([['v=spf1 ', '-all']]);
    expect(records.caa[0]).toMatchObject({ critical: 0, issue: 'letsencrypt.org' });
    expect(records.soa).toMatchObject({ serial: 20261118, nsname: 'ns.example.test' });
  });

  it('feeds real DNS-shaped SPF, DKIM and DMARC results into existing grading', async () => {
    vi.stubGlobal('fetch', vi.fn(dnsFixture));
    const info = await getEmailAuthInfo('example.test');
    expect(info).toMatchObject({ grade: 'A', spf: { present: true }, dkim: { present: true }, dmarc: { present: true, policy: 'reject' } });
  });

  it('keeps a resolver outage distinct from a successful empty record set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    await expect(getDNSInfo('example.test')).rejects.toThrow('DNS lookup unavailable');
  });
});
