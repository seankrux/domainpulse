import { ServiceConfig, EmailAuthInfo } from '../types';
import { logger } from '../utils/logger';
import { getSessionToken } from '../utils/authSession';

const DEFAULT_PROXY_URL = 'http://localhost:3001';

/**
 * Fetch SPF/DKIM/DMARC email-auth grade for a domain.
 * Enrichment only — never affects liveness (AGENTS.md §1).
 *
 * On transport failure this throws so `Promise.allSettled` marks the slot
 * rejected and callers can keep prior enrichment (do not invent grade F).
 */
export const checkEmailAuth = async (domain: string, config?: ServiceConfig): Promise<EmailAuthInfo> => {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = config?.authToken;

  if (!token) {
    token = getSessionToken() || undefined;
  }

  try {
    const endpoints = [
      `/api/email-auth?domain=${encodeURIComponent(cleanDomain)}`,
      `${proxyUrl}/api/email-auth?domain=${encodeURIComponent(cleanDomain)}`,
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
    logger.error(`Email auth lookup failed for ${cleanDomain}:`, error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      throw error;
    }
  }

  throw new Error(`Failed to fetch email authentication info for ${cleanDomain}`);
};
