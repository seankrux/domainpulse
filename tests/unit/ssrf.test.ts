import { describe, it, expect } from 'vitest';
import { isBlockedHost, validateOutboundUrl, isBlockedIp, validateOutboundUrlResolved } from '../../api/_utils/ssrfGuard';

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
