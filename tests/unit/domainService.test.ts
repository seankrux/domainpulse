import { describe, it, expect } from 'vitest';
import { validateAndNormalizeUrl, normalizeUrl } from '../../services/domainService';

describe('domainService', () => {
  describe('validateAndNormalizeUrl', () => {
    it('should accept valid domain names', () => {
      expect(validateAndNormalizeUrl('google.com')).toEqual({
        valid: true,
        url: 'google.com'
      });
      expect(validateAndNormalizeUrl('www.example.org')).toEqual({
        valid: true,
        url: 'www.example.org'
      });
      expect(validateAndNormalizeUrl('sub.domain.co.uk')).toEqual({
        valid: true,
        url: 'sub.domain.co.uk'
      });
    });

    it('should strip http/https protocols', () => {
      expect(validateAndNormalizeUrl('http://google.com')).toEqual({
        valid: true,
        url: 'google.com'
      });
      expect(validateAndNormalizeUrl('https://example.org')).toEqual({
        valid: true,
        url: 'example.org'
      });
    });

    it('should reject empty input', () => {
      expect(validateAndNormalizeUrl('')).toEqual({
        valid: false,
        error: 'URL is required'
      });
      expect(validateAndNormalizeUrl('   ')).toEqual({
        valid: false,
        error: 'URL is required'
      });
    });

    it('should reject dangerous protocols', () => {
      expect(validateAndNormalizeUrl('javascript:alert(1)')).toEqual({
        valid: false,
        error: 'Invalid URL format'
      });
      expect(validateAndNormalizeUrl('data:text/html,<script>alert(1)</script>')).toEqual({
        valid: false,
        error: 'Invalid URL format'
      });
      expect(validateAndNormalizeUrl('vbscript:msgbox(1)')).toEqual({
        valid: false,
        error: 'Invalid URL format'
      });
      expect(validateAndNormalizeUrl('file:///etc/passwd')).toEqual({
        valid: false,
        error: 'Invalid URL format'
      });
      expect(validateAndNormalizeUrl('ftp://files.example.com')).toEqual({
        valid: false,
        error: 'Invalid URL format'
      });
    });

    it('should reject injection attempts', () => {
      expect(validateAndNormalizeUrl('google.com@evil.com')).toEqual({
        valid: false,
        error: 'Invalid URL format'
      });
      expect(validateAndNormalizeUrl('google.com..evil.com')).toEqual({
        valid: false,
        error: 'Invalid URL format'
      });
      expect(validateAndNormalizeUrl('google.com%00evil.com')).toEqual({
        valid: false,
        error: 'Invalid URL format'
      });
    });

    it('should reject invalid domain formats', () => {
      expect(validateAndNormalizeUrl('not-a-domain')).toEqual({
        valid: false,
        error: 'Please enter a valid domain name (e.g., google.com)'
      });
      expect(validateAndNormalizeUrl('.com')).toEqual({
        valid: false,
        error: 'Please enter a valid domain name (e.g., google.com)'
      });
      expect(validateAndNormalizeUrl('domain.')).toEqual({
        valid: false,
        error: 'Please enter a valid domain name (e.g., google.com)'
      });
    });

    it('should trim whitespace', () => {
      expect(validateAndNormalizeUrl('  google.com  ')).toEqual({
        valid: true,
        url: 'google.com'
      });
    });

    it('should reject domains starting or ending with hyphens', () => {
      expect(validateAndNormalizeUrl('-google.com')).toEqual({
        valid: false,
        error: 'Please enter a valid domain name (e.g., google.com)'
      });
      expect(validateAndNormalizeUrl('google-.com')).toEqual({
        valid: false,
        error: 'Please enter a valid domain name (e.g., google.com)'
      });
    });
  });

  describe('normalizeUrl', () => {
    it('should normalize valid domains', () => {
      expect(normalizeUrl('https://google.com')).toBe('google.com');
      expect(normalizeUrl('http://www.example.org/path')).toBe('www.example.org');
      expect(normalizeUrl('GOOGLE.COM')).toBe('google.com');
    });

    it('should handle domains with ports', () => {
      expect(normalizeUrl('localhost:3000')).toBe('localhost:3000');
    });
  });
});
