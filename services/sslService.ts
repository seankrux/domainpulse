import { SSLStatus, SSLInfo, ServiceConfig } from '../types';
import { logger } from '../utils/logger';
import { config } from '../lib/config';

interface SslApiResponse {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  error?: string;
}

const DEFAULT_PROXY_URL = config.proxy.defaultUrl;
const AUTH_SESSION_KEY = 'domainpulse_auth_session';

const getStoredToken = (): string | null => {
  try {
    const storedSession = localStorage.getItem(AUTH_SESSION_KEY);
    if (!storedSession) return null;
    const parsed = JSON.parse(storedSession) as { token?: string; expiresAt?: number };
    if (!parsed?.token || !parsed.expiresAt || parsed.expiresAt <= Date.now()) return null;
    return parsed.token;
  } catch {
    return null;
  }
};

/**
 * Check SSL certificate information for a domain.
 * Uses a public SSL checker API or falls back to basic HTTPS check.
 */
export const checkSSL = async (url: string, config?: ServiceConfig): Promise<SSLInfo> => {
  const domain = extractDomain(url);
  
  if (!domain) {
    return { status: SSLStatus.Invalid };
  }

  // Determine proxy URL and token
  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = config?.authToken;
  
  if (!token && typeof localStorage !== 'undefined') {
    token = getStoredToken() || undefined;
  }

  try {
    // Try to get SSL info via our API proxy
    // Try Vercel endpoint first, then proxy
    const endpoints = [
      `/api/ssl?domain=${encodeURIComponent(domain)}`,
      `${proxyUrl}/api/ssl?domain=${encodeURIComponent(domain)}`
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 
            'Accept': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          }
        });

        if (response.status === 401) {
          throw new Error('Unauthorized');
        }

        if (response.ok) {
          const data: SslApiResponse = await response.json();
          return parseSSLResponse(data);
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Unauthorized') {
          throw e;
        }
        continue;
      }
    }
  } catch (error) {
    logger.warn(`SSL API unavailable for ${domain}, using basic check:`, error);
  }

  // Fallback: Return unknown instead of attempting a direct fetch (which causes CORS errors)
  return { status: SSLStatus.Unknown };
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

const extractDomain = (url: string): string | null => {
  let domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  domain = domain.split(':')[0] || ''; // Remove port, ensure string
  
  if (!domain || !domain.includes('.')) {
    return null;
  }
  
  return domain;
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
