import { DomainStatus, SSLStatus, SSLInfo, DomainExpiry, ServiceConfig, DNSInfo, TechStackInfo } from '../types';
import { checkSSL } from './sslService';
import { checkDomainExpiry } from './expiryService';
import { checkDNS } from './dnsService';
import { detectTechStack } from './techDetectionService';
import { logger } from '../utils/logger';
import { config } from '../lib/config';
import { getSessionToken } from '../utils/authSession';

const DEFAULT_PROXY_URL = config.proxy.defaultUrl;

export interface DomainCheckResult {
  status: DomainStatus;
  statusCode: number;
  latency: number;
}

/**
 * Validate and normalize URL input.
 * Prevents protocol injection, XSS, and malicious URLs.
 */
export const validateAndNormalizeUrl = (input: string): { valid: boolean; url?: string; error?: string } => {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return { valid: false, error: 'URL is required' };
  }
  
  // Check for dangerous patterns
  const dangerousPatterns = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'ftp:',
    '@',
    '..',
    '%00',
    '%0a',
    '%0d'
  ];
  
  const lowerInput = trimmed.toLowerCase();
  for (const pattern of dangerousPatterns) {
    if (lowerInput.includes(pattern)) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }
  
  // Remove any leading protocols for normalization
  let normalized = trimmed.replace(/^https?:\/\//i, '');
  
  // Validate domain format (simple but effective)
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}(\/[^\s]*)?$/;
  
  if (!domainRegex.test(normalized)) {
    return { valid: false, error: 'Please enter a valid domain name (e.g., google.com)' };
  }
  
  // Remove trailing slashes and convert to lowercase
  normalized = normalized.replace(/\/$/, '').toLowerCase();
  
  // Extract just the domain part (no paths for monitoring)
  const domainOnly = normalized.split('/')[0];
  
  return { valid: true, url: domainOnly };
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
  PromiseSettledResult<TechStackInfo>
];

/**
 * Check domain liveness, then enrich with SSL/expiry/DNS/Tech.
 *
 * INVARIANT (AGENTS.md §1): liveness is the single source of truth. The hard
 * timeout guards ONLY the uptime probe. Enrichment runs afterwards under
 * `allSettled` + a soft timeout that resolves to defaults — so a slow or failing
 * sub-check can never turn an ALIVE domain into Error. `Error` is reachable only
 * when the uptime probe itself fails (auth, network, or timeout).
 */
export const checkDomainWithSSL = async (url: string, serviceConfig?: ServiceConfig): Promise<DomainCheckResult & { ssl: SSLInfo; expiry?: DomainExpiry; dns?: DNSInfo; techStack?: TechStackInfo }> => {
  const timeoutMs = serviceConfig?.timeout || config.timeouts.domainCheck;
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
        const response = await fetch(`${endpoint}?url=${encodeURIComponent(targetUrl)}&ua=${encodeURIComponent(userAgent)}&timeout=${timeoutMs}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });

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
  const settled = await raceToDefault<EnrichmentSettled | null>(
    Promise.allSettled([
      checkSSL(url, serviceConfig),
      checkDomainExpiry(url, serviceConfig),
      checkDNS(url, serviceConfig),
      detectTechStack(url, serviceConfig)
    ]) as Promise<EnrichmentSettled>,
    remaining,
    null
  );

  const sslResult: SSLInfo = settled && settled[0].status === 'fulfilled' ? settled[0].value : { status: SSLStatus.Unknown };
  const expiryResult = settled && settled[1].status === 'fulfilled' ? settled[1].value : { status: 'unknown' as const };
  const dnsResult = settled && settled[2].status === 'fulfilled' ? settled[2].value : undefined;
  const techResult = settled && settled[3].status === 'fulfilled' ? settled[3].value : { confidence: 'low' as const };

  return {
    ...domainResult,
    ssl: sslResult,
    expiry: expiryResult.status !== 'unknown' ? expiryResult : undefined,
    dns: dnsResult && !dnsResult.error ? dnsResult : undefined,
    techStack: techResult.confidence !== 'low' ? techResult : undefined
  };
};
