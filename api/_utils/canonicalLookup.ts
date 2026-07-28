/**
 * Canonical / HTTPS variant checker — enrichment only (AGENTS.md §1).
 * Probes http/https × www/non-www and analyses redirect consistency.
 */
import { probeRedirectChain } from './ssrfGuard';

export type UrlVariant = 'https_apex' | 'https_www' | 'http_apex' | 'http_www';

export interface UrlVariantResult {
  variant: UrlVariant;
  inputUrl: string;
  finalUrl: string;
  statusCode: number;
  reachable: boolean;
  redirectChain: string[];
}

export interface CanonicalCheckResult {
  status: 'correct' | 'issues' | 'unknown';
  variants: UrlVariantResult[];
  canonicalUrl?: string;
  issues: string[];
  httpsEnforced: boolean;
  wwwConsistent: boolean;
  preferredHost?: 'www' | 'apex';
}

function stripWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host;
}

function normalizeHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}${u.pathname === '/' ? '' : u.pathname}`.replace(/\/$/, '');
  } catch {
    return url;
  }
}

function buildVariants(domain: string): { variant: UrlVariant; url: string }[] {
  const apex = stripWww(domain.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase());
  return [
    { variant: 'https_apex', url: `https://${apex}` },
    { variant: 'https_www', url: `https://www.${apex}` },
    { variant: 'http_apex', url: `http://${apex}` },
    { variant: 'http_www', url: `http://www.${apex}` },
  ];
}

function isHttps(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function hasWww(url: string): boolean {
  try {
    return new URL(url).hostname.startsWith('www.');
  } catch {
    return false;
  }
}

/**
 * Pure analysis of variant probe results — exported for unit tests.
 */
export function analyzeCanonicalVariants(variants: UrlVariantResult[]): CanonicalCheckResult {
  const reachable = variants.filter((v) => v.reachable);
  if (reachable.length === 0) {
    return {
      status: 'unknown',
      variants,
      issues: ['No URL variants responded'],
      httpsEnforced: false,
      wwwConsistent: false,
    };
  }

  const finalHosts = reachable.map((v) => normalizeHost(v.finalUrl));
  const uniqueFinals = [...new Set(finalHosts)];
  const issues: string[] = [];

  const httpVariants = reachable.filter((v) => v.variant.startsWith('http_'));
  const httpNotRedirectingToHttps = httpVariants.filter((v) => !isHttps(v.finalUrl));
  const httpsEnforced = httpVariants.length === 0 || httpNotRedirectingToHttps.length === 0;
  if (!httpsEnforced) {
    issues.push('HTTP does not redirect to HTTPS');
  }

  const wwwFlags = reachable.map((v) => hasWww(v.finalUrl));
  const wwwConsistent = wwwFlags.every((f) => f === wwwFlags[0]);
  if (!wwwConsistent) {
    issues.push('www and non-www resolve to different destinations');
  }

  const canonicalUrl = uniqueFinals.length === 1 ? uniqueFinals[0] : undefined;
  if (!canonicalUrl && uniqueFinals.length > 1) {
    issues.push(`Multiple canonical destinations: ${uniqueFinals.join(', ')}`);
  }

  const preferredHost: 'www' | 'apex' | undefined =
    canonicalUrl && hasWww(canonicalUrl) ? 'www' : canonicalUrl ? 'apex' : undefined;

  const unreachable = variants.filter((v) => !v.reachable && !v.redirectChain.length);
  if (unreachable.length > 0 && unreachable.length < variants.length) {
    issues.push(`${unreachable.length} variant(s) did not respond`);
  }

  return {
    status: issues.length === 0 ? 'correct' : 'issues',
    variants,
    canonicalUrl,
    issues,
    httpsEnforced,
    wwwConsistent,
    preferredHost,
  };
}

export async function checkCanonicalVariants(
  domain: string,
  opts: { timeoutMs?: number; userAgent?: string } = {},
): Promise<CanonicalCheckResult> {
  const variants = buildVariants(domain);
  const results: UrlVariantResult[] = [];

  for (const { variant, url } of variants) {
    const probe = await probeRedirectChain(url, opts);
    results.push({
      variant,
      inputUrl: url,
      finalUrl: probe.finalUrl,
      statusCode: probe.status,
      reachable: probe.reachable,
      redirectChain: probe.redirectChain,
    });
  }

  return analyzeCanonicalVariants(results);
}
