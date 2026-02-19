import { DomainStatus, SSLInfo, DomainExpiry, ServiceConfig, DNSInfo } from '../types';
import { checkSSL } from './sslService';
import { checkDomainExpiry } from './expiryService';
import { checkDNS } from './dnsService';
import { logger } from '../utils/logger';
import { config } from '../lib/config';

const DEFAULT_PROXY_URL = config.proxy.defaultUrl;
const AUTH_SESSION_KEY = 'domainpulse_auth_session';
const getStoredToken = (): string | null => {
  try {
    const storedSession = localStorage.getItem(AUTH_SESSION_KEY);
    if (!storedSession) return null;
    const parsed = JSON.parse(storedSession) as { token?: string; expiresAt?: number };
    if (!parsed?.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) {
      return null;
    }
    return parsed.token;
  } catch {
    return null;
  }
};

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
  url = url.replace(/\/$/, '');
  return url;
};

/**
 * Check domain with SSL, expiry, and DNS information.
 * Includes timeout to prevent hanging.
 */
export const checkDomainWithSSL = async (url: string, serviceConfig?: ServiceConfig): Promise<DomainCheckResult & { ssl: SSLInfo; expiry?: DomainExpiry; dns?: DNSInfo }> => {
  // Create a timeout promise using centralized config
  const timeoutMs = serviceConfig?.timeout || config.timeouts.domainCheck;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Domain check timeout')), timeoutMs);
  });

  // Race between the actual check and timeout
  const checkInternal = async (): Promise<DomainCheckResult & { ssl: SSLInfo; expiry?: DomainExpiry; dns?: DNSInfo }> => {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`;

    // Determine proxy URL and token
    const proxyUrl = serviceConfig?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
    let token = serviceConfig?.authToken;
    const userAgent = serviceConfig?.userAgent || 'DomainPulse/1.0 (Domain Monitor)';
    const timeout = serviceConfig?.timeout || config.timeouts.domainCheck;
    
    // In main thread (where localStorage is available), we can get the token if not provided
    if (!token && typeof localStorage !== 'undefined') {
      token = getStoredToken() || undefined;
    }

    // Try Vercel API first (for production), then fall back to local proxy
    const apiEndpoints = [
      '/api/check', // Vercel serverless function (port 3000)
      `${proxyUrl}/api/check` // Local proxy server (port 3001)
    ];

    logger.debug(`Checking domain: ${url}`, { targetUrl, endpoints: apiEndpoints });

  let domainResult: DomainCheckResult | null = null;
    let authFailure: Error | null = null;

    for (const endpoint of apiEndpoints) {
      try {
        const response = await fetch(`${endpoint}?url=${encodeURIComponent(targetUrl)}&ua=${encodeURIComponent(userAgent)}&timeout=${timeout}`, {
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

    const [sslResult, expiryResult, dnsResult] = await Promise.all([
      checkSSL(url, config),
      checkDomainExpiry(url, config),
      checkDNS(url, config)
    ]);

    return {
      ...domainResult,
      ssl: sslResult,
      expiry: expiryResult.status !== 'unknown' ? expiryResult : undefined,
      dns: dnsResult && !dnsResult.error ? dnsResult : undefined
    };
  };

  return Promise.race([checkInternal(), timeoutPromise]);
};
