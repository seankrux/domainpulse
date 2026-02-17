import { SSLStatus, SSLInfo } from '../types';
import { logger } from '../utils/logger';

interface SslApiResponse {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  error?: string;
}

/**
 * Check SSL certificate information for a domain.
 * Uses a public SSL checker API or falls back to basic HTTPS check.
 */
export const checkSSL = async (url: string): Promise<SSLInfo> => {
  const domain = extractDomain(url);
  
  if (!domain) {
    return { status: SSLStatus.Invalid };
  }

  try {
    // Try to get SSL info via our API proxy
    const response = await fetch(`/api/ssl?domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const data: SslApiResponse = await response.json();
      return parseSSLResponse(data);
    }
  } catch (error) {
    logger.warn(`SSL API unavailable for ${domain}, using basic check:`, error);
  }

  // Fallback: Basic HTTPS check
  return basicSSLCheck(url);
};

/**
 * Basic SSL check - just verifies if HTTPS is available.
 * This is a fallback when the SSL API is unavailable.
 */
const basicSSLCheck = async (url: string): Promise<SSLInfo> => {
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (targetUrl.startsWith('https://')) {
      // Assume valid SSL if HTTPS works
      return {
        status: SSLStatus.Valid,
        issuer: 'Unknown (Basic Check)',
        validFrom: new Date(),
        validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Assume 1 year
        daysUntilExpiry: 365
      };
    }

    return { status: SSLStatus.Invalid };
  } catch (error) {
    logger.debug(`Basic SSL check failed for ${targetUrl}:`, error);
    return { status: SSLStatus.Unknown };
  }
};

/**
 * Parse SSL response from API.
 */
const parseSSLResponse = (data: SslApiResponse): SSLInfo => {
  // Add validation
  if (!data || typeof data !== 'object') {
    return { status: SSLStatus.Unknown };
  }
  
  if (!data.valid || data.error) {
    return { status: SSLStatus.Invalid };
  }

  const validTo = data.validTo ? new Date(data.validTo) : null;
  const daysUntilExpiry = validTo 
    ? Math.ceil((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : undefined;

  let status = SSLStatus.Valid;
  if (daysUntilExpiry !== undefined) {
    if (daysUntilExpiry <= 0) {
      status = SSLStatus.Expired;
    } else if (daysUntilExpiry <= 30) {
      status = SSLStatus.Expiring;
    }
  }

  return {
    status,
    issuer: data.issuer || 'Unknown',
    validFrom: data.validFrom ? new Date(data.validFrom) : undefined,
    validTo: validTo || undefined,
    daysUntilExpiry
  };
};

/**
 * Extract domain from URL.
 */
const extractDomain = (url: string): string | null => {
  let domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  domain = domain.split(':')[0]; // Remove port
  
  if (!domain || domain.includes('.')) {
    return domain;
  }
  
  return null;
};

/**
 * Get SSL status badge color.
 */
export const getSSLStatusColor = (status: SSLStatus): string => {
  switch (status) {
    case SSLStatus.Valid:
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case SSLStatus.Expiring:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case SSLStatus.Expired:
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
    case SSLStatus.Invalid:
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400';
  }
};

/**
 * Get SSL status label.
 */
export const getSSLStatusLabel = (status: SSLStatus): string => {
  switch (status) {
    case SSLStatus.Valid:
      return 'Valid';
    case SSLStatus.Expiring:
      return 'Expiring';
    case SSLStatus.Expired:
      return 'Expired';
    case SSLStatus.Invalid:
      return 'Invalid';
    default:
      return 'Unknown';
  }
};
