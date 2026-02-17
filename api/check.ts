import { VercelRequest, VercelResponse } from '@vercel/node';

interface CheckResult {
  status: 'ALIVE' | 'DOWN' | 'ERROR';
  statusCode: number;
  latency: number;
  message?: string;
}

// Rate limiting: Track requests per IP
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

// Allowed origins for CORS (configure via environment variable)
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

// CORS headers - restricted in production
const getCorsHeaders = (origin?: string) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  
  // In production, only allow specific origins
  if (ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  }
  
  return headers;
};

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
  const origin = req.headers.origin;
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders);
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    res.set(corsHeaders);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute.'
    });
  }

  const url = req.query.url as string;

  if (!url) {
    res.set(corsHeaders);
    return res.status(400).json({ error: 'URL is required' });
  }

  const startTime = Date.now();
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'DomainPulse/1.0 (Domain Monitor)'
      }
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    const result: CheckResult = {
      status: response.ok ? 'ALIVE' : 'DOWN',
      statusCode: response.status,
      latency
    };

    res.set(corsHeaders);
    res.status(200).json(result);
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    res.set(corsHeaders);
    res.status(200).json({
      status: 'DOWN' as const,
      statusCode: 0,
      latency,
      message: errorMessage
    });
  }
}
