import { DomainExpiry, ServiceConfig } from '../types';
import { logger } from '../utils/logger';

interface WhoisApiResponse {
  expiryDate?: string;
  registrar?: string;
  error?: string;
}

const DEFAULT_PROXY_URL = 'http://localhost:3001';
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
 * Check domain expiry information using WHOIS API.
 */
export const checkDomainExpiry = async (domain: string, config?: ServiceConfig): Promise<DomainExpiry> => {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  // Determine proxy URL and token
  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = config?.authToken;
  
  if (!token && typeof localStorage !== 'undefined') {
    token = getStoredToken() || undefined;
  }

  try {
    // Try Vercel API first, then proxy
    const endpoints = [
      `/api/whois?domain=${encodeURIComponent(cleanDomain)}`,
      `${proxyUrl}/api/whois?domain=${encodeURIComponent(cleanDomain)}`
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
          const data: WhoisApiResponse = await response.json();
          return parseWhoisResponse(data);
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Unauthorized') {
          throw e;
        }
        continue;
      }
    }
  } catch (error) {
    logger.warn(`WHOIS API unavailable for ${cleanDomain}:`, error);
  }

  // Fallback: return unknown status
  return {
    status: 'unknown',
    expiryDate: undefined,
    registrar: undefined,
    daysUntilExpiry: undefined
  };
};

/**
 * Parse WHOIS API response.
 */
const parseWhoisResponse = (data: WhoisApiResponse): DomainExpiry => {
  if (!data || data.error) {
    return {
      status: 'unknown',
      expiryDate: undefined,
      registrar: undefined,
      daysUntilExpiry: undefined
    };
  }

  const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  const daysUntilExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : undefined;

  let status: DomainExpiry['status'] = 'active';
  if (daysUntilExpiry !== undefined) {
    if (daysUntilExpiry <= 0) {
      status = 'expired';
    } else if (daysUntilExpiry <= 30) {
      status = 'expiring';
    }
  }

  return {
    status,
    expiryDate: expiryDate || undefined,
    registrar: data.registrar || 'Unknown',
    daysUntilExpiry
  };
};

/**
 * Get expiry status badge color.
 */
export const getExpiryStatusColor = (status: string): string => {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'expiring':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
    case 'expired':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
    default:
      return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400';
  }
};

/**
 * Get expiry status label.
 */
export const getExpiryStatusLabel = (status: string): string => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'expiring':
      return 'Expiring';
    case 'expired':
      return 'Expired';
    default:
      return 'Unknown';
  }
};
