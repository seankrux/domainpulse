import { ServiceConfig, DNSInfo } from '../types';
import { logger } from '../utils/logger';

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
 * Fetch DNS and NS information for a domain.
 */
export const checkDNS = async (domain: string, config?: ServiceConfig): Promise<DNSInfo> => {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  // Determine proxy URL and token
  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = config?.authToken;
  
  if (!token && typeof localStorage !== 'undefined') {
    token = getStoredToken() || undefined;
  }

  try {
    const endpoints = [
      `/api/dns?domain=${encodeURIComponent(cleanDomain)}`,
      `${proxyUrl}/api/dns?domain=${encodeURIComponent(cleanDomain)}`
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
          return await response.json();
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Unauthorized') {
          throw e;
        }
        continue;
      }
    }
  } catch (error) {
    logger.error(`DNS lookup failed for ${cleanDomain}:`, error);
  }

  return { error: 'Failed to fetch DNS information' };
};
