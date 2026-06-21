import { VercelRequest, VercelResponse } from '@vercel/node';
import { getCorsHeaders, verifyAuth } from './_utils/auth.js';
import { checkRateLimit, getRateLimitHeaders } from './_utils/rateLimit.js';
import { isBlockedHost } from './_utils/ssrfGuard.js';
import { getSSLCertificate } from './_utils/sslLookup.js';
import { config } from '../lib/config.js';

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

  // Only allow GET requests (check method BEFORE auth to avoid leaking auth status)
  if (req.method !== 'GET') {
    setHeaders(corsHeaders);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify authentication
  if (!verifyAuth(req)) {
    setHeaders(corsHeaders);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const domain = req.query.domain as string;

  if (!domain) {
    setHeaders(corsHeaders);
    return res.status(400).json({ error: 'Domain is required' });
  }

  if (isBlockedHost(domain.replace(/^https?:\/\//, '').split('/')[0])) {
    setHeaders(corsHeaders);
    return res.status(400).json({ error: 'Blocked: private/internal host not allowed' });
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
