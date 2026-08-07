import { describe, it, expect } from 'vitest';
import { analyzeCanonicalVariants, UrlVariantResult } from '../../api/_utils/canonicalLookup';

const variant = (
  variantName: UrlVariantResult['variant'],
  inputUrl: string,
  finalUrl: string,
  reachable = true,
  statusCode = 200,
): UrlVariantResult => ({
  variant: variantName,
  inputUrl,
  finalUrl,
  statusCode,
  reachable,
  redirectChain: [inputUrl, finalUrl],
});

describe('analyzeCanonicalVariants', () => {
  it('marks correct when all variants redirect to https apex', () => {
    const canonical = 'https://example.com';
    const result = analyzeCanonicalVariants([
      variant('https_apex', 'https://example.com', canonical),
      variant('https_www', 'https://www.example.com', canonical),
      variant('http_apex', 'http://example.com', canonical),
      variant('http_www', 'http://www.example.com', canonical),
    ]);
    expect(result.status).toBe('correct');
    expect(result.httpsEnforced).toBe(true);
    expect(result.wwwConsistent).toBe(true);
    expect(result.canonicalUrl).toBe(canonical);
    expect(result.issues).toHaveLength(0);
  });

  it('flags HTTP not redirecting to HTTPS', () => {
    const result = analyzeCanonicalVariants([
      variant('https_apex', 'https://example.com', 'https://example.com'),
      variant('http_apex', 'http://example.com', 'http://example.com'),
    ]);
    expect(result.status).toBe('issues');
    expect(result.httpsEnforced).toBe(false);
    expect(result.issues).toContain('HTTP does not redirect to HTTPS');
  });

  it('flags www inconsistency', () => {
    const result = analyzeCanonicalVariants([
      variant('https_apex', 'https://example.com', 'https://example.com'),
      variant('https_www', 'https://www.example.com', 'https://www.example.com'),
    ]);
    expect(result.status).toBe('issues');
    expect(result.wwwConsistent).toBe(false);
    expect(result.issues).toContain('www and non-www resolve to different destinations');
  });

  it('returns unknown when no variants respond', () => {
    const result = analyzeCanonicalVariants([
      variant('https_apex', 'https://example.com', 'https://example.com', false, 0),
    ]);
    expect(result.status).toBe('unknown');
    expect(result.issues).toContain('No URL variants responded');
  });
});
