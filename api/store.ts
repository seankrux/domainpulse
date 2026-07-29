import { VercelRequest, VercelResponse } from '@vercel/node';
import { getCorsHeaders, verifyAuth } from './_utils/auth.js';
import { checkRateLimit, getRateLimitHeaders } from './_utils/rateLimit.js';
import { isDatabaseConfigured } from './_utils/db.js';
import { loadStore, saveStore, PersistedStore } from './_utils/domainStore.js';
import { config } from '../lib/config.js';
import type { Domain, DomainGroup } from '../types.js';

function reviveIncomingDomain(raw: Record<string, unknown>): Domain {
  const history = Array.isArray(raw.history)
    ? raw.history.map((h) => {
        const rec = h as Record<string, unknown>;
        return {
          timestamp: new Date(String(rec.timestamp)),
          status: rec.status as Domain['status'],
          statusCode: Number(rec.statusCode) || 0,
          latency: Number(rec.latency) || 0,
        };
      })
    : [];

  return {
    ...(raw as unknown as Domain),
    addedAt: new Date(String(raw.addedAt)),
    lastChecked: raw.lastChecked ? new Date(String(raw.lastChecked)) : undefined,
    history,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const setHeaders = (headers: Record<string, string>) => {
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
  };

  const origin = req.headers.origin;
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    setHeaders(corsHeaders);
    return res.status(200).end();
  }

  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const isRateLimited = await checkRateLimit(ip, {
    maxRequests: config.rateLimit.maxRequests,
    windowMs: config.rateLimit.windowMs,
  });
  if (!isRateLimited) {
    setHeaders(corsHeaders);
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please wait a minute.',
    });
  }

  setHeaders(
    await getRateLimitHeaders(ip, {
      maxRequests: config.rateLimit.maxRequests,
      windowMs: config.rateLimit.windowMs,
    }),
  );

  if (!verifyAuth(req)) {
    setHeaders(corsHeaders);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isDatabaseConfigured()) {
    setHeaders(corsHeaders);
    return res.status(503).json({
      error: 'Database unavailable',
      message: 'DATABASE_URL is not configured. Using local browser storage.',
      persistence: 'local',
    });
  }

  try {
    if (req.method === 'GET') {
      const store = await loadStore();
      setHeaders(corsHeaders);
      return res.status(200).json({ ...store, persistence: 'neon' });
    }

    if (req.method === 'PUT') {
      const body = req.body as Partial<PersistedStore>;
      const domains = Array.isArray(body.domains)
        ? body.domains.map((d) => reviveIncomingDomain(d as unknown as Record<string, unknown>))
        : [];
      const groups = Array.isArray(body.groups) ? (body.groups as DomainGroup[]) : [];
      const settings =
        body.settings && typeof body.settings === 'object' ? body.settings : {};

      await saveStore({ domains, groups, settings });
      setHeaders(corsHeaders);
      return res.status(200).json({ ok: true, persistence: 'neon', count: domains.length });
    }

    setHeaders(corsHeaders);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    setHeaders(corsHeaders);
    return res.status(500).json({ error: 'Store operation failed', message });
  }
}
