import { VercelRequest, VercelResponse } from '@vercel/node';
import * as dns from 'dns';
import { verifyAuth, getCorsHeaders } from './_utils/auth';
import { checkRateLimit, getRateLimitHeaders } from './_utils/rateLimit';
import { config } from '../lib/config';

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

  // Add rate limit headers
  setHeaders(getRateLimitHeaders(ip, { maxRequests: config.rateLimit.maxRequests, windowMs: config.rateLimit.windowMs }));

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
    const dnsInfo = await getDNSInfo(domain);
    setHeaders(corsHeaders);
    res.status(200).json(dnsInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setHeaders(corsHeaders);
    res.status(200).json({
      error: errorMessage
    });
  }
}

async function getDNSInfo(domain: string) {
  const resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']); // Use public DNS for reliability

  try {
    const [a, mx, ns, txt, cname] = await Promise.allSettled([
      resolver.resolve4(domain),
      resolver.resolveMx(domain),
      resolver.resolveNs(domain),
      resolver.resolveTxt(domain),
      resolver.resolveCname(domain).catch(() => []) // CNAME might not exist
    ]);

    return {
      a: a.status === 'fulfilled' ? a.value : [],
      mx: mx.status === 'fulfilled' ? mx.value : [],
      ns: ns.status === 'fulfilled' ? ns.value : [],
      txt: txt.status === 'fulfilled' ? txt.value : [],
      cname: cname.status === 'fulfilled' ? cname.value : []
    };
  } catch (error) {
    throw new Error(`DNS resolution failed for ${domain}`);
  }
}
