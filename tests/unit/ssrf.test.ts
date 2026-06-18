import { describe, it, expect } from 'vitest';
import { isBlockedHost, validateOutboundUrl } from '../../api/_utils/ssrfGuard';

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
