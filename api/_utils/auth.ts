import { VercelRequest } from '@vercel/node';

const AUTH_PASSWORD_HASH = process.env.VITE_PASSWORD_HASH || '';
const AUTH_ALLOW_BOOTSTRAP = process.env.VITE_ALLOW_INITIAL_LOGIN === 'true' || process.env.NODE_ENV !== 'production';

const resolveAuthToken = () => {
  const [token] = AUTH_PASSWORD_HASH.split(':');
  return token || '';
};

/**
 * Verify authentication token for Vercel Serverless Functions.
 */
export const verifyAuth = (req: VercelRequest): boolean => {
  // If no password is set, allow all (dev mode)
  if (!AUTH_PASSWORD_HASH) {
    return AUTH_ALLOW_BOOTSTRAP;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  // Simple token verification: in this app, the token IS the hash for simplicity
  // In a full app, this would be a JWT
  return token === resolveAuthToken();
};

export const isAuthBootstrapAllowed = (): boolean => AUTH_ALLOW_BOOTSTRAP;
export const getAuthToken = (): string => resolveAuthToken();

/**
 * Common CORS headers for production serverless functions.
 */
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

export const getCorsHeaders = (origin?: string) => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
  
  if (ALLOWED_ORIGINS.includes('*') || (origin && ALLOWED_ORIGINS.includes(origin))) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  }
  
  return headers;
};
