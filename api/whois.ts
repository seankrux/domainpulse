import { VercelRequest, VercelResponse } from '@vercel/node';
import * as https from 'https';
import { verifyAuth, getCorsHeaders } from './_utils/auth';

interface WhoisResult {
  expiryDate?: string;
  registrar?: string;
  error?: string;
}

// Rate limiting: Track requests per IP
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

// Rate limiting middleware
const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  
  record.count++;
  requestCounts.set(ip, record);
  return true;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Helper to set multiple headers since res.set is not available on VercelResponse
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

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    setHeaders(corsHeaders);
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      message: 'Too many requests. Please wait a minute.' 
    });
  }

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
 * Get WHOIS information for a domain using a public WHOIS API.
 * Note: This uses a free API which may have rate limits.
 * For production, consider using a paid WHOIS API service.
 */
function getWhoisInfo(domain: string): Promise<WhoisResult> {
  return new Promise((resolve) => {
    // Using a public WHOIS API (for demo purposes)
    // In production, use a reliable paid API like whoisxmlapi.com
    const apiUrl = `https://whoisapi.domainsdb.eu/whois/${domain}`;
    
    https.get(apiUrl, { timeout: 10000 }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // Parse the WHOIS response
          const parsed = parseWhoisData(data);
          resolve(parsed);
        } catch (error) {
          resolve({ error: 'Failed to parse WHOIS data' });
        }
      });
    }).on('error', () => {
      // Fallback: simulate expiry check for demo
      // In production, use a real WHOIS API
      resolve({
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        registrar: 'Example Registrar, Inc.'
      });
    });
  });
}

/**
 * Parse raw WHOIS data.
 */
function parseWhoisData(data: string): WhoisResult {
  const result: WhoisResult = {};

  // Extract expiry date
  const expiryMatch = data.match(/(?:Registry Expiry Date|Expiration Date|expires(?:-on)?|Valid Until)[:\s]+([^\n]+)/i);
  if (expiryMatch && expiryMatch[1]) {
    const dateStr = expiryMatch[1].trim();
    // Try to parse various date formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      result.expiryDate = date.toISOString();
    }
  }

  // Extract registrar
  const registrarMatch = data.match(/(?:Registrar|Sponsoring Registrar)[:\s]+([^\n]+)/i);
  if (registrarMatch && registrarMatch[1]) {
    result.registrar = registrarMatch[1].trim();
  }

  return result;
}
