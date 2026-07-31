import { ServiceConfig, SecurityHeadersInfo } from '../types';
import { logger } from '../utils/logger';
import { getSessionToken } from '../utils/authSession';

const DEFAULT_PROXY_URL = 'http://localhost:3001';

/**
 * Fetch security-header grade for a domain.
 * Enrichment only — never affects liveness (AGENTS.md §1).
 */
export const checkSecurityHeaders = async (domain: string, config?: ServiceConfig): Promise<SecurityHeadersInfo> => {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = config?.authToken;

  if (!token) {
    token = getSessionToken() || undefined;
  }

  const userAgent = config?.userAgent || 'DomainPulse/1.0 (Domain Monitor)';

  try {
    const endpoints = [
      `/api/security-headers?domain=${encodeURIComponent(cleanDomain)}&ua=${encodeURIComponent(userAgent)}`,
      `${proxyUrl}/api/security-headers?domain=${encodeURIComponent(cleanDomain)}&ua=${encodeURIComponent(userAgent)}`,
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
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
    logger.error(`Security headers lookup failed for ${cleanDomain}:`, error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error;
    }
  }

  return {
    grade: 'F',
    score: 0,
    maxScore: 100,
    headers: [],
    issues: ['Failed to fetch security headers'],
  };
};
