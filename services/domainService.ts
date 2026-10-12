import { DomainStatus, SSLStatus, SSLInfo, DomainExpiry, ServiceConfig, DNSInfo, TechStackInfo, CanonicalCheckInfo, EmailAuthInfo, SecurityHeadersInfo, DomainHealthInfo } from '../types';
import { checkSSL } from './sslService';
import { checkDomainExpiry } from './expiryService';
import { checkDNS } from './dnsService';
import { detectTechStack } from './techDetectionService';
import { checkCanonical } from './canonicalService';
import { checkEmailAuth } from './emailAuthService';
import { checkSecurityHeaders } from './securityHeadersService';
import { computeDomainHealth } from '../utils/domainHealth';
import { logger } from '../utils/logger';
import { config } from '../lib/config';
import { getSessionToken } from '../utils/authSession';
import { fetchWithRetry } from './apiClient';

const DEFAULT_PROXY_URL = config.proxy.defaultUrl;

export interface DomainCheckResult {
  status: DomainStatus;
  statusCode: number;
  latency: number;
}

/**
 * Validate and normalize a domain the user typed into the monitor.
 *
 * The monitor tracks bare domains (paths are discarded), so this accepts:
 *   google.com, http://google.com, sub.domain.co.uk, example.com/some/path
 * and rejects non-http(s) schemes plus classic injection forms
 * (`real-host@evil-host`, NUL/newline encodings, `..` in the host).
 *
 * Parsing the host out first (rather than substring-scanning the whole input)
 * avoids false negatives such as `example.com/a..b` or a path containing `@`,
 * which the old whole-string blocklist wrongly rejected. Deeper network-level
 * validation (SSRF, DNS) is the server's job — see api/_utils/ssrfGuard.ts.
 */
export const validateAndNormalizeUrl = (input: string): { valid: boolean; url?: string; error?: string } => {
  const trimmed = input.trim();

  if (!trimmed) {
    return { valid: false, error: 'URL is required' };
  }

  // Reject any explicit scheme other than http/https (javascript:, data:,
  // vbscript:, file:, ftp:, ...). A bare "google.com" has no scheme and passes.
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (schemeMatch && !/^https?$/i.test(schemeMatch[1] ?? '')) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Strip an optional http(s):// prefix, then isolate the host (drop any
  // path, query, or fragment — the monitor only tracks the domain).
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '');
  const host = withoutScheme.split(/[/?#]/)[0] ?? '';

  // A bare domain never carries userinfo; `host@other-host` is an injection.
  if (host.includes('@')) {
    return { valid: false, error: 'Invalid URL format' };
  }

  // NUL/newline smuggling and empty labels ("..") are never valid in a host.
  if (/\.\./.test(host) || /%00|%0a|%0d/i.test(host)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

  if (!domainRegex.test(host)) {
    return { valid: false, error: 'Please enter a valid domain name (e.g., google.com)' };
  }

  return { valid: true, url: host.toLowerCase() };
};

/**
 * Simple URL normalization (for internal use).
 * Use validateAndNormalizeUrl for user input.
 */
export const normalizeUrl = (input: string): string => {
  let url = input.trim().toLowerCase();
  url = url.replace(/^https?:\/\//, '');
  url = url.replace(/\/.*$/, ''); // Remove path and trailing slashes
  return url;
};

/**
 * Reject `p` after `ms` with `message`. Clears its own timer so a settled
 * promise never leaves a dangling timeout (which would keep Node/tests alive).
 */
const withTimeout = <T>(p: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });

/**
 * Resolve to `fallback` after `ms` instead of rejecting. Used for enrichment:
 * a slow OR failing enrichment must degrade to safe defaults, never throw.
 */
const raceToDefault = <T>(p: Promise<T>, ms: number, fallback: T): Promise<T> =>
  new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      () => { clearTimeout(timer); resolve(fallback); }
    );
  });

type EnrichmentSettled = [
  PromiseSettledResult<SSLInfo>,
  PromiseSettledResult<DomainExpiry>,
  PromiseSettledResult<DNSInfo>,
  PromiseSettledResult<TechStackInfo>,
  PromiseSettledResult<CanonicalCheckInfo>,
  PromiseSettledResult<EmailAuthInfo>,
  PromiseSettledResult<SecurityHeadersInfo>
];

/**
 * Check domain liveness, then enrich with SSL/expiry/DNS/Tech/canonical/email/headers.
 *
 * INVARIANT (AGENTS.md §1): liveness is the single source of truth. The hard
 * timeout guards ONLY the uptime probe. Enrichment runs afterwards under
 * `allSettled` + a soft timeout that resolves to defaults — so a slow or failing
 * sub-check can never turn an ALIVE domain into Error. `Error` is reachable only
 * when the uptime probe itself fails (auth, network, or timeout).
 */
export const checkDomainWithSSL = async (url: string, serviceConfig?: ServiceConfig): Promise<DomainCheckResult & {
  ssl?: SSLInfo;
  expiry?: DomainExpiry;
  dns?: DNSInfo;
  techStack?: TechStackInfo;
  canonical?: CanonicalCheckInfo;
  emailAuth?: EmailAuthInfo;
  securityHeaders?: SecurityHeadersInfo;
  health?: DomainHealthInfo;
  /** True when enrichment lost the soft timeout race — callers must keep prior enrichment. */
  enrichmentTimedOut?: boolean;
}> => {
  const rawTimeout = serviceConfig?.timeout ?? config.timeouts.domainCheck;
  const timeoutMs = Math.min(
    Math.max(rawTimeout, config.timeouts.minProbeTimeout),
    config.timeouts.maxProbeTimeout
  );
  const deadline = Date.now() + timeoutMs;

  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  // Determine proxy URL and token
  const proxyUrl = serviceConfig?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = serviceConfig?.authToken;
  const userAgent = serviceConfig?.userAgent || 'DomainPulse/1.0 (Domain Monitor)';

  // In the main thread the session lives in sessionStorage; pull it if the
  // caller (e.g. a single-domain check) didn't pass one explicitly. In a Web
  // Worker getSessionToken() returns null, so the token must come from config.
  if (!token) {
    token = getSessionToken() || undefined;
  }

  // Try Vercel API first (for production), then fall back to local proxy.
  const apiEndpoints = [
    '/api/check', // Vercel serverless function (port 3000)
    `${proxyUrl}/api/check` // Local proxy server (port 3001)
  ];

  logger.debug(`Checking domain: ${url}`, { targetUrl, endpoints: apiEndpoints });

  // --- Phase 1: liveness (the ONLY thing the hard timeout guards) ---
  const resolveLiveness = async (): Promise<DomainCheckResult> => {
    let domainResult: DomainCheckResult | null = null;
    let authFailure: Error | null = null;

    for (const endpoint of apiEndpoints) {
      try {
        // Retries a 429 (honouring Retry-After) instead of reporting a
        // rate-limited liveness probe as Error. Bounded by the same deadline
        // the hard timeout uses, so it can never overrun the check budget.
        const response = await fetchWithRetry(
          `${endpoint}?url=${encodeURIComponent(targetUrl)}&ua=${encodeURIComponent(userAgent)}&timeout=${timeoutMs}`,
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            }
          },
          { deadline, label: `check ${targetUrl}` }
        );

        if (response.status === 401) {
          logger.warn(`Auth failed for endpoint ${endpoint} for ${url}`);
          authFailure = new Error('Unauthorized');
          continue;
        }

        if (!response.ok) {
          logger.warn(`Endpoint ${endpoint} returned status ${response.status} for ${url}`);
          continue; // Try next endpoint
        }

        const data = await response.json();

        domainResult = {
          status: data.status === 'ALIVE' ? DomainStatus.Alive : DomainStatus.Down,
          statusCode: data.statusCode,
          latency: data.latency
        };
        logger.debug(`Success from ${endpoint} for ${url}`, domainResult);
        break;
      } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
          authFailure = error;
        }
        logger.error(`Error checking endpoint ${endpoint} for ${url}`, error);
        continue;
      }
    }

    if (!domainResult) {
      if (authFailure) {
        throw authFailure;
      }
      logger.warn(`All check endpoints failed for ${url}, returning error state`);
      throw new Error(`All endpoints unavailable for ${url}`);
    }

    return domainResult;
  };

  const domainResult = await withTimeout(resolveLiveness(), timeoutMs, 'Domain check timeout');

  // --- Phase 2: enrichment — secondary to liveness, never throws ---
  // Bound enrichment to whatever budget remains so the overall call stays
  // within timeoutMs. If liveness used the whole budget, enrichment degrades to
  // defaults immediately — the domain still reports its true ALIVE/DOWN status.
  const remaining = Math.max(0, deadline - Date.now());
  // Enrichment shares the liveness deadline so a rate-limit backoff inside a
  // sub-check can't push past the check budget either.
  const enrichmentConfig: ServiceConfig = { ...serviceConfig, deadline };
  const settled = await raceToDefault<EnrichmentSettled | null>(
    Promise.allSettled([
      checkSSL(url, enrichmentConfig),
      checkDomainExpiry(url, enrichmentConfig),
      checkDNS(url, enrichmentConfig),
      detectTechStack(url, enrichmentConfig),
      checkCanonical(url, enrichmentConfig),
      checkEmailAuth(url, enrichmentConfig),
      checkSecurityHeaders(url, enrichmentConfig),
    ]) as Promise<EnrichmentSettled>,
    remaining,
    null
  );

  // Soft timeout / total budget exhausted: keep liveness, do NOT wipe prior enrichment.
  if (!settled) {
    return { ...domainResult, enrichmentTimedOut: true };
  }

  const sslResult: SSLInfo = settled[0].status === 'fulfilled' ? settled[0].value : { status: SSLStatus.Unknown };
  const expiryResult = settled[1].status === 'fulfilled' ? settled[1].value : { status: 'unknown' as const };
  const dnsResult = settled[2].status === 'fulfilled' ? settled[2].value : undefined;
  const techResult = settled[3].status === 'fulfilled' ? settled[3].value : { confidence: 'low' as const };
  const canonicalResult = settled[4].status === 'fulfilled' ? settled[4].value : undefined;
  const emailAuthResult = settled[5].status === 'fulfilled' ? settled[5].value : undefined;
  const securityHeadersResult = settled[6].status === 'fulfilled' ? settled[6].value : undefined;

  const dns = dnsResult && !dnsResult.error ? dnsResult : undefined;
  const emailAuth = emailAuthResult;
  const securityHeaders = securityHeadersResult;
  const health = computeDomainHealth({
    ssl: sslResult,
    dns,
    canonical: canonicalResult,
    emailAuth,
    securityHeaders,
  });

  return {
    ...domainResult,
    ssl: sslResult,
    expiry: expiryResult.status !== 'unknown' ? expiryResult : undefined,
    dns,
    techStack: techResult.confidence !== 'low' ? techResult : undefined,
    canonical: canonicalResult,
    emailAuth,
    securityHeaders,
    health,
  };
};
