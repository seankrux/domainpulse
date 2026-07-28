import { ServiceConfig, CanonicalCheckInfo } from '../types';
import { logger } from '../utils/logger';
import { getSessionToken } from '../utils/authSession';

const DEFAULT_PROXY_URL = 'http://localhost:3001';

/**
 * Check http/https × www/non-www redirect consistency for a domain.
 * Enrichment only — never affects liveness (AGENTS.md §1).
 */
export const checkCanonical = async (domain: string, config?: ServiceConfig): Promise<CanonicalCheckInfo> => {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = config?.authToken;

  if (!token) {
    token = getSessionToken() || undefined;
  }

  const timeout = config?.timeout ?? 10000;
  const userAgent = config?.userAgent || 'DomainPulse/1.0 (Domain Monitor)';

  try {
    const endpoints = [
      `/api/canonical?domain=${encodeURIComponent(cleanDomain)}&timeout=${timeout}&ua=${encodeURIComponent(userAgent)}`,
      `${proxyUrl}/api/canonical?domain=${encodeURIComponent(cleanDomain)}&timeout=${timeout}&ua=${encodeURIComponent(userAgent)}`,
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
          const data = await response.json();
          return { ...data, lastChecked: new Date() };
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Unauthorized') {
          throw e;
        }
        continue;
      }
    }
  } catch (error) {
    logger.error(`Canonical check failed for ${cleanDomain}:`, error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error;
    }
  }

  return {
    status: 'unknown',
    variants: [],
    issues: ['Failed to fetch canonical check'],
    httpsEnforced: false,
    wwwConsistent: false,
  };
};
