import { DomainExpiry, ServiceConfig } from '../types';
import { logger } from '../utils/logger';
import { getSessionToken } from '../utils/authSession';

interface WhoisApiResponse {
  expiryDate?: string;
  createdDate?: string;
  updatedDate?: string;
  registrar?: string;
  registrarUrl?: string;
  registrarIanaId?: string;
  domainStatus?: string[];
  nameServers?: string[];
  dnssec?: string;
  error?: string;
}

const DEFAULT_PROXY_URL = 'http://localhost:3001';

/**
 * Check domain expiry information using WHOIS API.
 */
export const checkDomainExpiry = async (domain: string, config?: ServiceConfig): Promise<DomainExpiry> => {
  const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  
  // Determine proxy URL and token
  const proxyUrl = config?.proxyUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PROXY_URL) || DEFAULT_PROXY_URL;
  let token = config?.authToken;

  if (!token) {
    token = getSessionToken() || undefined;
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
      createdDate: undefined,
      updatedDate: undefined,
      registrar: undefined,
      daysUntilExpiry: undefined
    };
  }

  const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  const createdDate = data.createdDate ? new Date(data.createdDate) : undefined;
  const updatedDate = data.updatedDate ? new Date(data.updatedDate) : undefined;
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
    createdDate,
    updatedDate,
    registrar: data.registrar || 'Unknown',
    registrarUrl: data.registrarUrl,
    registrarIanaId: data.registrarIanaId,
    domainStatus: data.domainStatus,
    nameServers: data.nameServers,
    dnssec: data.dnssec,
    daysUntilExpiry
  };
};
