import { ServiceConfig, DNSInfo } from '../types';
import { logger } from '../utils/logger';
import { getSessionToken } from '../utils/authSession';

const DEFAULT_PROXY_URL = 'http://localhost:3001';

/**
 * Fetch DNS and NS information for a domain.
 */
export const checkDNS = async (domain: string, config?: ServiceConfig): Promise<DNSInfo> => {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  // Determine proxy URL and token
  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = config?.authToken;

  if (!token) {
    token = getSessionToken() || undefined;
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
