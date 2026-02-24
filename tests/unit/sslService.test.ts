import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkSSL, getSSLStatusColor, getSSLStatusLabel } from '../../services/sslService';
import { SSLStatus } from '../../types';

type Mock = ReturnType<typeof vi.fn>;

describe('sslService', () => {
  describe('getSSLStatusColor', () => {
    it('should return valid color for VALID status', () => {
      const result = getSSLStatusColor(SSLStatus.Valid);
      expect(result).toContain('bg-emerald');
    });

    it('should return warning color for EXPIRING status', () => {
      const result = getSSLStatusColor(SSLStatus.Expiring);
      expect(result).toContain('bg-amber');
    });

    it('should return error color for EXPIRED status', () => {
      const result = getSSLStatusColor(SSLStatus.Expired);
      expect(result).toContain('bg-rose');
    });

    it('should return error color for INVALID status', () => {
      const result = getSSLStatusColor(SSLStatus.Invalid);
      expect(result).toContain('bg-red');
    });

    it('should return neutral color for UNKNOWN status', () => {
      const result = getSSLStatusColor(SSLStatus.Unknown);
      expect(result).toContain('bg-slate');
    });
  });

  describe('getSSLStatusLabel', () => {
    it('should return correct label for VALID', () => {
      expect(getSSLStatusLabel(SSLStatus.Valid)).toBe('Valid');
    });

    it('should return correct label for EXPIRING', () => {
      expect(getSSLStatusLabel(SSLStatus.Expiring)).toBe('Expiring');
    });

    it('should return correct label for EXPIRED', () => {
      expect(getSSLStatusLabel(SSLStatus.Expired)).toBe('Expired');
    });

    it('should return correct label for INVALID', () => {
      expect(getSSLStatusLabel(SSLStatus.Invalid)).toBe('Invalid');
    });

    it('should return correct label for UNKNOWN', () => {
      expect(getSSLStatusLabel(SSLStatus.Unknown)).toBe('Unknown');
    });
  });

  describe('checkSSL', () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return SSL info for valid domain', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const mockResponse = {
        valid: true,
        issuer: 'Let\'s Encrypt',
        validFrom: new Date().toISOString(),
        validTo: futureDate.toISOString(),
        daysUntilExpiry: 300
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await checkSSL('example.com');
      expect(result.status).toBe(SSLStatus.Valid);
      expect(result.issuer).toBe('Let\'s Encrypt');
    });

    it('should return UNKNOWN status on error', async () => {
      (global.fetch as Mock).mockRejectedValueOnce(new Error('Network error'));

      const result = await checkSSL('example.com');
      expect(result.status).toBe(SSLStatus.Unknown);
    });

    it('should handle domain with protocol prefix', async () => {
      const mockResponse = {
        valid: true,
        issuer: 'Cloudflare',
        validFrom: '2024-01-01T00:00:00.000Z',
        validTo: '2024-12-31T00:00:00.000Z',
        daysUntilExpiry: 300
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await checkSSL('https://example.com');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('domain=example.com'),
        expect.any(Object)
      );
    });

    it('should use proxy URL from config', async () => {
      const mockResponse = {
        status: 'VALID',
        issuer: 'DigiCert',
        validFrom: '2024-01-01T00:00:00.000Z',
        validTo: '2024-12-31T00:00:00.000Z',
        daysUntilExpiry: 300
      };

      (global.fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      await checkSSL('example.com', { proxyUrl: 'http://custom-proxy:3001' });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('domain=example.com'),
        expect.any(Object)
      );
    });

    it('should return UNKNOWN when API returns 401', async () => {
      (global.fetch as Mock).mockResolvedValueOnce({
        status: 401,
        ok: false
      });

      const result = await checkSSL('example.com');
      expect(result.status).toBe(SSLStatus.Unknown);
    });

    it('should try multiple endpoints on failure', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const mockResponse = {
        valid: true,
        issuer: 'Backup CA',
        validFrom: new Date().toISOString(),
        validTo: futureDate.toISOString(),
        daysUntilExpiry: 300
      };

      // First endpoint fails, second succeeds
      (global.fetch as Mock)
        .mockRejectedValueOnce(new Error('First endpoint failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });

      const result = await checkSSL('example.com');
      expect(result.status).toBe(SSLStatus.Valid);
    });
  });
});
