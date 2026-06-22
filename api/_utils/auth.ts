import { VercelRequest } from '@vercel/node';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const AUTH_PASSWORD_HASH = process.env.VITE_PASSWORD_HASH || '';

// Auth is OPT-IN. It is enforced only when a password hash is configured
// (VITE_PASSWORD_HASH). With no hash the app runs as a public demo — matching
// the dev proxy (`server/proxy.ts`, which allows all when no hash is set) and
// the AuthGuard "skip authentication" stub. Without this, the stub front-end
// sends no token while the API demanded one → every domain returned 401 and
// showed Error even when ALIVE. See AGENTS.md §7.
const AUTH_ENABLED = Boolean(AUTH_PASSWORD_HASH);

// JWT_SECRET is only used to sign/verify session tokens, which only happens when
// auth is enabled. Requiring it in public mode would crash every request for a
// feature that isn't in use.
const JWT_SECRET = process.env.JWT_SECRET;

// Validate JWT_SECRET is present in production *when auth is actually enabled*.
if (AUTH_ENABLED && process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required when VITE_PASSWORD_HASH is set in production. Generate a secure random string (e.g., openssl rand -hex 32) and set it in your environment.');
}

// Fallback for development only. Generated randomly per process so there is no
// hard-coded secret in the source (tokens simply don't survive a dev restart,
// which is fine for local use). Production always requires JWT_SECRET above.
const devJWTSecret = process.env.NODE_ENV === 'production'
  ? ''
  : crypto.randomBytes(32).toString('hex');
const effectiveJWTSecret = JWT_SECRET || devJWTSecret;

const SESSION_TTL_SECONDS = Number(process.env.VITE_AUTH_SESSION_TTL_MINUTES || 720) * 60;

interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
}

/**
 * Generate JWT token for authenticated user.
 */
export const generateToken = (): { token: string; expiresAt: number } => {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload: JWTPayload = {
    sub: 'domainpulse-user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(expiresAt / 1000)
  };

  const token = jwt.sign(payload, effectiveJWTSecret);
  return { token, expiresAt };
};

/**
 * Verify JWT token from request.
 */
export const verifyAuth = (req: VercelRequest): boolean => {
  // Public mode: no password configured → allow (portfolio demo / dev-proxy
  // parity). Setting VITE_PASSWORD_HASH switches the whole API to require a
  // valid Bearer token.
  if (!AUTH_ENABLED) {
    return true;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  if (!token) return false;

  try {
    jwt.verify(token, effectiveJWTSecret);
    return true;
  } catch {
    return false;
  }
};

/**
 * Check if bootstrap (first-time password setup) is allowed.
 * NEVER allowed in production.
 */
export const isAuthBootstrapAllowed = (): boolean => {
  return process.env.NODE_ENV !== 'production' && process.env.VITE_ALLOW_INITIAL_LOGIN === 'true';
};

/**
 * Common CORS headers for production serverless functions.
 * Requires explicit origin configuration in production.
 */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').filter(Boolean) || [];

export const getCorsHeaders = (origin?: string) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  // In production, require explicit origin - no wildcards
  if (process.env.NODE_ENV === 'production') {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Vary'] = 'Origin';
    }
    // If no matching origin, don't set ACAO header (browser will block)
  } else {
    // Development: allow specified origins or localhost
    const devOrigins = ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000'];
    const allOrigins = [...ALLOWED_ORIGINS, ...devOrigins];
    
    if (origin && allOrigins.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Vary'] = 'Origin';
    } else if (ALLOWED_ORIGINS.length === 0) {
      // If no origins configured in dev, allow all (for convenience)
      headers['Access-Control-Allow-Origin'] = '*';
    }
  }

  return headers;
};
