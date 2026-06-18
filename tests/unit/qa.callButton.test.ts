import { describe, it, expect } from 'vitest';
import { isCallRailScript, normalizeTel } from '../../qa/callButtonService';

describe('qa/callButtonService pure helpers', () => {
  describe('isCallRailScript', () => {
    it('matches real CallRail swap script URLs', () => {
      expect(isCallRailScript('https://cdn.callrail.com/companies/123/abc/12/swap.js')).toBe(true);
      expect(isCallRailScript('//cdn.callrail.com/companies/x/y/12/swap.js')).toBe(true);
      expect(isCallRailScript('https://CDN.CALLRAIL.COM/a/b/SWAP.JS')).toBe(true);
    });

    it('rejects non-CallRail / adversarial sources', () => {
      expect(isCallRailScript('https://example.com/swap.js')).toBe(false);
      // Spoofed host where callrail.com is not followed by a path slash is rejected.
      expect(isCallRailScript('https://callrail.com.evil.com/x/swap.js')).toBe(false);
      expect(isCallRailScript('https://notcallrail.com/swap.js')).toBe(false);
      expect(isCallRailScript('https://cdn.callrail.com/analytics.js')).toBe(false);
      expect(isCallRailScript('')).toBe(false);
      expect(isCallRailScript(null)).toBe(false);
      expect(isCallRailScript(undefined)).toBe(false);
    });
  });

  describe('normalizeTel', () => {
    it('strips tel: scheme and formatting', () => {
      expect(normalizeTel('tel:+1 (800) 555-1234')).toBe('+18005551234');
      expect(normalizeTel('tel:8005551234')).toBe('8005551234');
      expect(normalizeTel('TEL:800.555.1234')).toBe('8005551234');
    });

    it('preserves leading plus', () => {
      expect(normalizeTel('tel:+44 20 7946 0958')).toBe('+442079460958');
    });

    it('treats placeholders / empties as empty', () => {
      expect(normalizeTel('tel:#')).toBe('');
      expect(normalizeTel('#')).toBe('');
      expect(normalizeTel('javascript:void(0)')).toBe('');
      expect(normalizeTel('')).toBe('');
      expect(normalizeTel(null)).toBe('');
      expect(normalizeTel(undefined)).toBe('');
      expect(normalizeTel('tel:')).toBe('');
    });

    it('two formatted versions of same number normalize equal', () => {
      expect(normalizeTel('tel:+1-800-555-1234')).toBe(normalizeTel('tel:+1 (800) 555 1234'));
    });
  });
});
