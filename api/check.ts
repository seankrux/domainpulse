import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, getCorsHeaders } from './_utils/auth.js';
import { checkRateLimit, getRateLimitHeaders } from './_utils/rateLimit.js';
import { safeHeadRequest, toCheckResult } from './_utils/ssrfGuard.js';
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

  // Add rate limit headers to successful responses
  const rateLimitHeaders = await getRateLimitHeaders(ip, { maxRequests: config.rateLimit.maxRequests, windowMs: config.rateLimit.windowMs });
  setHeaders(rateLimitHeaders);

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

  const url = req.query.url as string;
  const userAgent = (req.query.ua as string) || 'DomainPulse/1.0 (Domain Monitor)';
  const timeoutMs = Math.min(parseInt(req.query.timeout as string) || 10000, 30000);

  if (!url) {
    setHeaders(corsHeaders);
    return res.status(400).json({ error: 'URL is required' });
  }

  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  // SSRF guard: resolve + validate every hop, follow redirects safely.
  const r = await safeHeadRequest(targetUrl, { timeoutMs, userAgent });
  setHeaders(corsHeaders);
  if (r.blocked) {
    return res.status(400).json({ error: 'Blocked', message: r.reason });
  }
  return res.status(200).json(toCheckResult(r));
}
