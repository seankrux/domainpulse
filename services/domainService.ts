import { DomainStatus } from '../types';
import { checkSSL } from './sslService';
import { checkDomainExpiry } from './expiryService';

const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001';

export interface DomainCheckResult {
  status: DomainStatus;
  statusCode: number;
  latency: number;
}

/**
 * Checks a domain's status by calling the proxy server or Vercel API.
 * Falls back to mock data if proxy is unavailable (for demo purposes).
 */
export const checkDomain = async (url: string): Promise<DomainCheckResult> => {
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;
  
  // Try Vercel API first (for production), then fall back to local proxy
  const apiEndpoints = [
    '/api/check', // Vercel serverless function
    `${PROXY_URL}/api/check` // Local proxy server
  ];

  for (const endpoint of apiEndpoints) {
    try {
      const response = await fetch(`${endpoint}?url=${encodeURIComponent(targetUrl)}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        continue; // Try next endpoint
      }

      const data = await response.json();

      return {
        status: data.status === 'ALIVE' ? DomainStatus.Alive : DomainStatus.Down,
        statusCode: data.statusCode,
        latency: data.latency
      };
    } catch (error) {
      // Try next endpoint
      continue;
    }
  }

  // All endpoints failed, use mock data
  console.warn('All endpoints unavailable, using mock data');
  return getMockDomainCheck(url);
};

/**
 * Check domain with SSL and expiry information.
 */
export const checkDomainWithSSL = async (url: string): Promise<DomainCheckResult & { ssl: any; expiry?: any }> => {
  const [domainResult, sslResult, expiryResult] = await Promise.all([
    checkDomain(url),
    checkSSL(url),
    checkDomainExpiry(url)
  ]);

  return {
    ...domainResult,
    ssl: sslResult,
    expiry: expiryResult.status !== 'unknown' ? expiryResult : undefined
  };
};

/**
 * Mock domain checking for demo/development when proxy is unavailable.
 */
const getMockDomainCheck = (url: string): { status: DomainStatus; statusCode: number; latency: number } => {
  const latency = Math.floor(Math.random() * 750) + 50;
  const lowerUrl = url.toLowerCase();

  // Well-known domains that should be "alive"
  if (lowerUrl.includes('google') || lowerUrl.includes('bing') || lowerUrl.includes('example') ||
      lowerUrl.includes('github') || lowerUrl.includes('microsoft') || lowerUrl.includes('amazon')) {
    return { status: DomainStatus.Alive, statusCode: 200, latency };
  }

  // Keywords that suggest failure
  if (lowerUrl.includes('fail') || lowerUrl.includes('down') || lowerUrl.includes('error')) {
    const errorCodes = [400, 403, 404, 500, 502, 503];
    const randomError = errorCodes[Math.floor(Math.random() * errorCodes.length)];
    return { status: DomainStatus.Down, statusCode: randomError, latency: 0 };
  }

  // Random chance for other domains
  const isAlive = Math.random() > 0.2;
  if (isAlive) {
    const successCodes = [200, 200, 200, 201];
    const code = successCodes[Math.floor(Math.random() * successCodes.length)];
    return { status: DomainStatus.Alive, statusCode: code, latency };
  } else {
    const errorCodes = [400, 403, 404, 500, 503];
    const code = errorCodes[Math.floor(Math.random() * errorCodes.length)];
    return { status: DomainStatus.Down, statusCode: code, latency: 0 };
  }
};

export const normalizeUrl = (input: string): string => {
  let url = input.trim().toLowerCase();
  url = url.replace(/^https?:\/\//, '');
  url = url.replace(/\/$/, '');
  return url;
};