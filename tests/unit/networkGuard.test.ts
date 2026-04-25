import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookup } from 'dns/promises';
import { normalizePublicHttpTarget, normalizeTimeoutMs } from '../../api/_utils/networkGuard';

vi.mock('dns/promises', () => {
  const lookupMock = vi.fn();
  return {
    default: { lookup: lookupMock },
    lookup: lookupMock
  };
});

const mockedLookup = vi.mocked(lookup);
const mockLookupAddresses = (addresses: Array<{ address: string; family: 4 | 6 }>) => {
  mockedLookup.mockResolvedValue(addresses as never);
};

describe('networkGuard', () => {
  beforeEach(() => {
    mockedLookup.mockReset();
  });

  describe('normalizeTimeoutMs', () => {
    it('uses fallback for invalid values', () => {
      expect(normalizeTimeoutMs(undefined)).toBe(10000);
      expect(normalizeTimeoutMs('not-a-number')).toBe(10000);
    });

    it('clamps timeout values', () => {
      expect(normalizeTimeoutMs('20')).toBe(1000);
      expect(normalizeTimeoutMs('999999')).toBe(15000);
      expect(normalizeTimeoutMs('5000')).toBe(5000);
    });
  });

  describe('normalizePublicHttpTarget', () => {
    it('normalizes public domain input to an HTTPS origin', async () => {
      mockLookupAddresses([{ address: '93.184.216.34', family: 4 }]);

      await expect(normalizePublicHttpTarget('Example.com/some/path?x=1')).resolves.toBe('https://example.com/');
      expect(mockedLookup).toHaveBeenCalledWith('example.com', { all: true, verbatim: true });
    });

    it('rejects localhost targets before DNS lookup', async () => {
      await expect(normalizePublicHttpTarget('localhost')).rejects.toThrow('Localhost targets are not allowed');
      expect(mockedLookup).not.toHaveBeenCalled();
    });

    it('rejects private direct IP targets', async () => {
      await expect(normalizePublicHttpTarget('http://127.0.0.1')).rejects.toThrow('Private or reserved network targets are not allowed');
      await expect(normalizePublicHttpTarget('http://10.0.0.5')).rejects.toThrow('Private or reserved network targets are not allowed');
    });

    it('rejects domains resolving to private network addresses', async () => {
      mockLookupAddresses([{ address: '192.168.1.10', family: 4 }]);

      await expect(normalizePublicHttpTarget('internal.example.com')).rejects.toThrow('Target resolves to a private or reserved network address');
    });
  });
});
