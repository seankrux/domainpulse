import { VercelRequest, VercelResponse } from '@vercel/node';
import * as https from 'https';
import { verifyAuth, getCorsHeaders } from './_utils/auth';
import { checkRateLimit, getRateLimitHeaders } from './_utils/rateLimit';
import { config } from '../lib/config';
import { parseTechFromHTML } from '../services/techDetectionService';

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

  const url = req.query.url as string;

  if (!url) {
    setHeaders(corsHeaders);
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const techStack = await detectTechStack(url);
    setHeaders(corsHeaders);
    res.status(200).json(techStack);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setHeaders(corsHeaders);
    res.status(200).json({
      error: errorMessage
    });
  }
}

/**
 * Fetch website content and detect technology stack.
 */
async function detectTechStack(url: string) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          // Get headers
          const headers: Record<string, string> = {};
          if (res.headers['x-powered-by']) headers['x-powered-by'] = res.headers['x-powered-by'] as string;
          if (res.headers['server']) headers['server'] = res.headers['server'] as string;

          // Parse HTML for tech detection
          const techStack = parseTechFromHTML(data, headers);
          resolve(techStack);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}
