import { describe, it, expect } from 'vitest';
import { parseWhoisData } from '../../api/_utils/whoisLookup';

describe('whoisLookup.parseWhoisData', () => {
  // Verisign/ICANN gTLD layout: the "Registrar WHOIS Server" and "Registrar URL"
  // sub-fields appear BEFORE the real "Registrar:" line.
  const verisign = [
    '   Domain Name: GOOGLE.COM',
    '   Registry Domain ID: 2138514_DOMAIN_COM-VRSN',
    '   Registrar WHOIS Server: whois.markmonitor.com',
    '   Registrar URL: http://www.markmonitor.com',
    '   Updated Date: 2019-09-09T15:39:04Z',
    '   Creation Date: 1997-09-15T04:00:00Z',
    '   Registry Expiry Date: 2028-09-14T04:00:00Z',
    '   Registrar: MarkMonitor Inc.',
    '   Registrar IANA ID: 292',
  ].join('\n');

  it('extracts the real registrar name, not a sub-field', () => {
    const r = parseWhoisData(verisign);
    expect(r.registrar).toBe('MarkMonitor Inc.');
    expect(r.registrarUrl).toBe('http://www.markmonitor.com');
  });

  it('extracts expiry and creation dates', () => {
    const r = parseWhoisData(verisign);
    expect(r.expiryDate).toBe(new Date('2028-09-14T04:00:00Z').toISOString());
    expect(r.createdDate).toBe(new Date('1997-09-15T04:00:00Z').toISOString());
  });

  it('handles a "Sponsoring Registrar" layout', () => {
    const body = 'Domain Name: EXAMPLE.NET\nSponsoring Registrar: Example Registrar LLC\n';
    expect(parseWhoisData(body).registrar).toBe('Example Registrar LLC');
  });
});
