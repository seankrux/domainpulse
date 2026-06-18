import { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyAuth, getCorsHeaders } from './_utils/auth.js';
import { checkRateLimit, getRateLimitHeaders } from './_utils/rateLimit.js';
import { lookupGmb } from './_utils/gmbLookup.js';
import { config } from '../lib/config.js';

/**
 * Google Business Profile (GMB) lookup via the Google Places API.
 *
 * Query params (one required):
 *   - placeId: a Google Place ID (preferred, stable)
 *   - query:   free-text business name + locality (resolved to a Place ID first)
 *
 * Requires GOOGLE_PLACES_API_KEY. Without it, returns status UNKNOWN with a
 * descriptive error so the UI degrades gracefully (same pattern as SSL/WHOIS).
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const setHeaders = (headers: Record<string, string>) => {
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  };

  const origin = req.headers.origin;
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    setHeaders(corsHeaders);
    return res.status(200).end();
  }

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const isRateLimited = await checkRateLimit(ip, { maxRequests: config.rateLimit.maxRequests, windowMs: config.rateLimit.windowMs });
  if (!isRateLimited) {
    setHeaders(corsHeaders);
    return res.status(429).json({ error: 'Rate limit exceeded', message: 'Too many requests. Please wait a minute.' });
  }
  setHeaders(await getRateLimitHeaders(ip, { maxRequests: config.rateLimit.maxRequests, windowMs: config.rateLimit.windowMs }));

  if (!verifyAuth(req)) {
    setHeaders(corsHeaders);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    setHeaders(corsHeaders);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const placeId = req.query.placeId as string | undefined;
  const query = req.query.query as string | undefined;

  if (!placeId && !query) {
    setHeaders(corsHeaders);
    return res.status(400).json({ error: 'placeId or query is required' });
  }

  setHeaders(corsHeaders);
  const result = await lookupGmb({ placeId, query });
  return res.status(200).json(result);
}
