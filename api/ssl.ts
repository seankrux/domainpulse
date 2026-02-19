import { VercelRequest, VercelResponse } from '@vercel/node';
import * as https from 'https';
import * as tls from 'tls';
import { getCorsHeaders, verifyAuth } from './_utils/auth';

interface SSLResult {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
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

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  if (!verifyAuth(req)) {
    setHeaders(corsHeaders);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      message: 'Too many requests. Please wait a minute.' 
    });
  }

  const domain = req.query.domain as string;

  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }

  try {
    const sslInfo = await getSSLCertificate(domain);
    setHeaders(corsHeaders);
    res.status(200).json(sslInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setHeaders(corsHeaders);
    res.status(200).json({
      valid: false,
      error: errorMessage
    });
  }
}

/**
 * Get SSL certificate information for a domain.
 */
function getSSLCertificate(domain: string): Promise<SSLResult> {
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 10000,
      agent: new https.Agent({
        rejectUnauthorized: false // We want to get cert even if invalid
      })
    };

    const req = https.request(options, (res) => {
      const socket = res.socket as tls.TLSSocket;
      const cert = socket.getPeerCertificate(true);

      if (!cert || Object.keys(cert).length === 0) {
        resolve({
          valid: false,
          error: 'No certificate found'
        });
        return;
      }

      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const issuer = cert.issuer?.CN || cert.issuer?.O || 'Unknown';

      resolve({
        valid: daysUntilExpiry > 0,
        issuer,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysUntilExpiry
      });
    });

    req.on('error', (error) => {
      resolve({
        valid: false,
        error: error.message
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        valid: false,
        error: 'Request timeout'
      });
    });

    req.end();
  });
}
