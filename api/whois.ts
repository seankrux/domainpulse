import { VercelRequest, VercelResponse } from '@vercel/node';
import * as https from 'https';
import { verifyAuth, getCorsHeaders } from './_utils/auth';
import { checkRateLimit, getRateLimitHeaders } from './_utils/rateLimit';
import { config } from '../lib/config';

interface WhoisResult {
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
  raw?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const setHeaders = (headers: Record<string, string>) => {
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  };

  const origin = req.headers.origin;
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setHeaders(corsHeaders);
    return res.status(200).end();
  }

  // Rate limiting (async for Vercel KV support)
  const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  const isRateLimited = await checkRateLimit(ip, { maxRequests: config.rateLimit.maxRequests, windowMs: config.rateLimit.windowMs });
  if (!isRateLimited) {
    setHeaders(corsHeaders);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute.'
    });
  }

  // Add rate limit headers
  setHeaders(await getRateLimitHeaders(ip, { maxRequests: config.rateLimit.maxRequests, windowMs: config.rateLimit.windowMs }));

  // Verify authentication
  if (!verifyAuth(req)) {
    setHeaders(corsHeaders);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    setHeaders(corsHeaders);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const domain = req.query.domain as string;

  if (!domain) {
    setHeaders(corsHeaders);
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    const whoisInfo = await getWhoisInfo(domain);
    setHeaders(corsHeaders);
    res.status(200).json(whoisInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setHeaders(corsHeaders);
    res.status(200).json({
      error: errorMessage
    });
  }
}

/**
 * Get WHOIS information for a domain using multiple fallback APIs.
 */
function getWhoisInfo(domain: string): Promise<WhoisResult> {
  return new Promise((resolve) => {
    // Try multiple WHOIS APIs in order of reliability
    const apiUrls = [
      `https://whoisapi.domainsdb.eu/whois/${domain}`,
      `https://whois.domaintools.com/whois/${domain}`,
      `https://api.whoapi.com/?domain=${domain}&r=whois`
    ];

    let lastError: Error | null = null;
    let attempts = 0;

    const tryNextApi = (index: number) => {
      if (index >= apiUrls.length) {
        resolve({
          error: `WHOIS lookup failed after ${attempts} attempts. Last error: ${lastError?.message}. Consider using a reliable WHOIS API service.`
        });
        return;
      }

      const apiUrl = apiUrls[index] as string;
      attempts++;

      https.get(apiUrl, { timeout: 10000 }, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = parseWhoisData(data);
            // If we got meaningful data, return it
            if (parsed.expiryDate || parsed.registrar || parsed.nameServers) {
              resolve(parsed);
            } else {
              // Try next API
              tryNextApi(index + 1);
            }
          } catch (error) {
            tryNextApi(index + 1);
          }
        });
      }).on('error', (error) => {
        lastError = error;
        tryNextApi(index + 1);
      });
    };

    tryNextApi(0);
  });
}

/**
 * Parse raw WHOIS data with enhanced field extraction.
 */
function parseWhoisData(data: string): WhoisResult {
  const result: WhoisResult = {};

  // Extract expiry date
  const expiryMatch = data.match(/(?:Registry Expiry Date|Expiration Date|expires(?:-on)?|Valid Until)[:\s]+([^\n]+)/i);
  if (expiryMatch && expiryMatch[1]) {
    const dateStr = expiryMatch[1].trim();
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      result.expiryDate = date.toISOString();
    }
  }

  // Extract created date
  const createdMatch = data.match(/(?:Creation Date|Registered On|Domain Registration Date|Created On)[:\s]+([^\n]+)/i);
  if (createdMatch && createdMatch[1]) {
    const dateStr = createdMatch[1].trim();
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      result.createdDate = date.toISOString();
    }
  }

  // Extract updated date
  const updatedMatch = data.match(/(?:Updated Date|Last Updated On|Domain Registration Updated Date)[:\s]+([^\n]+)/i);
  if (updatedMatch && updatedMatch[1]) {
    const dateStr = updatedMatch[1].trim();
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      result.updatedDate = date.toISOString();
    }
  }

  // Extract registrar
  const registrarMatch = data.match(/(?:Registrar|Sponsoring Registrar)[:\s]+([^\n]+)/i);
  if (registrarMatch && registrarMatch[1]) {
    result.registrar = registrarMatch[1].trim();
  }

  // Extract registrar URL
  const registrarUrlMatch = data.match(/(?:Registrar URL|Registrar Information)[:\s]+([^\n]+)/i);
  if (registrarUrlMatch && registrarUrlMatch[1]) {
    result.registrarUrl = registrarUrlMatch[1].trim();
  }

  // Extract registrar IANA ID
  const registrarIanaIdMatch = data.match(/(?:Registrar IANA ID|Registrar ID)[:\s]+([^\n]+)/i);
  if (registrarIanaIdMatch && registrarIanaIdMatch[1]) {
    result.registrarIanaId = registrarIanaIdMatch[1].trim();
  }

  // Extract domain status
  const statusMatches = data.matchAll(/(?:Domain Status|Status)[:\s]+([^\n]+)/gi);
  const statuses = Array.from(statusMatches, m => m[1]?.trim()).filter((s): s is string => !!s);
  if (statuses.length > 0) {
    result.domainStatus = statuses;
  }

  // Extract name servers
  const nsMatches = data.matchAll(/(?:Name Server|Nameserver|DNS)[:\s]+([^\n]+)/gi);
  const nameServers = Array.from(nsMatches, m => m[1]?.trim()).filter((s): s is string => !!s);
  if (nameServers.length > 0) {
    result.nameServers = nameServers;
  }

  // Extract DNSSEC
  const dnssecMatch = data.match(/(?:DNSSEC)[:\s]+([^\n]+)/i);
  if (dnssecMatch && dnssecMatch[1]) {
    result.dnssec = dnssecMatch[1].trim();
  }

  // Store raw data for debugging
  result.raw = data;

  return result;
}
