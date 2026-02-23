import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, getCorsHeaders } from './_utils/auth';
import { checkRateLimit, getRateLimitHeaders } from './_utils/rateLimit';
import { config } from '../lib/config';

interface CheckResult {
  status: 'ALIVE' | 'DOWN' | 'ERROR';
  statusCode: number;
  latency: number;
  message?: string;
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

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip, { maxRequests: config.rateLimit.maxRequests, windowMs: config.rateLimit.windowMs })) {
    setHeaders(corsHeaders);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute.'
    });
  }

  // Add rate limit headers to successful responses
  const rateLimitHeaders = getRateLimitHeaders(ip, { maxRequests: config.rateLimit.maxRequests, windowMs: config.rateLimit.windowMs });
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
  const timeoutMs = parseInt(req.query.timeout as string) || 10000;

  if (!url) {
    setHeaders(corsHeaders);
    return res.status(400).json({ error: 'URL is required' });
  }

  const startTime = Date.now();
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent
      }
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    const result: CheckResult = {
      status: response.ok ? 'ALIVE' : 'DOWN',
      statusCode: response.status,
      latency
    };

    setHeaders(corsHeaders);
    res.status(200).json(result);
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    setHeaders(corsHeaders);
    res.status(200).json({
      status: 'DOWN' as const,
      statusCode: 0,
      latency,
      message: errorMessage
    });
  }
}
