import { VercelRequest, VercelResponse } from '@vercel/node';
import { getCorsHeaders, isAuthEnabled } from './_utils/auth.js';

/**
 * GET /api/auth-status → { authRequired: boolean }
 *
 * Tells the frontend whether this deployment is password-protected
 * (VITE_PASSWORD_HASH configured). The AuthGuard shows the login portal only
 * when this returns true, keeping the login-less public demo working when no
 * password is set (AGENTS.md §7). Mirrored by the dev proxy route in
 * server/proxy.ts — keep the two in agreement.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const corsHeaders = getCorsHeaders(req.headers.origin);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.json({ authRequired: isAuthEnabled() });
}
