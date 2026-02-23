import { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

const AUTH_PASSWORD_HASH = process.env.VITE_PASSWORD_HASH || '';
const JWT_SECRET = process.env.JWT_SECRET || process.env.VITE_PASSWORD_HASH || 'dev-secret-change-in-production';
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
  
  const token = jwt.sign(payload, JWT_SECRET);
  return { token, expiresAt };
};

/**
 * Verify JWT token from request.
 */
export const verifyAuth = (req: VercelRequest): boolean => {
  // If no password is set, deny all requests in production
  if (!AUTH_PASSWORD_HASH) {
    // Only allow in explicit dev mode
    return process.env.NODE_ENV !== 'production' && process.env.VITE_ALLOW_INITIAL_LOGIN === 'true';
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  if (!token) return false;

  try {
    jwt.verify(token, JWT_SECRET);
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
