import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { getCorsHeaders, isAuthBootstrapAllowed, generateToken } from './_utils/auth';

let AUTH_PASSWORD_HASH = process.env.VITE_PASSWORD_HASH || '';
const SESSION_TTL_MINUTES = Number(process.env.VITE_AUTH_SESSION_TTL_MINUTES || 720); // 12h

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

  // Only allow POST requests
  if (req.method !== 'POST') {
    setHeaders(corsHeaders);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;

  if (!password) {
    setHeaders(corsHeaders);
    return res.status(400).json({ error: 'Password is required' });
  }

  // If no hash is set, first login can set the password ONLY in explicit dev mode
  // NEVER allowed in production
  if (!AUTH_PASSWORD_HASH) {
    if (!isAuthBootstrapAllowed()) {
      setHeaders(corsHeaders);
      return res.status(500).json({ 
        error: 'Authentication password hash not configured. Set VITE_PASSWORD_HASH environment variable.' 
      });
    }
    
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
    AUTH_PASSWORD_HASH = `${hash}:${salt}`;
    
    // Generate JWT token
    const { token, expiresAt } = generateToken();
    
    setHeaders(corsHeaders);
    return res.json({ 
      token, 
      expiresAt, 
      message: 'Password initialized for development. Set VITE_PASSWORD_HASH in production environment variables.' 
    });
  }

  const [hash, salt] = AUTH_PASSWORD_HASH.split(':');
  if (!hash || !salt) {
    setHeaders(corsHeaders);
    return res.status(500).json({ error: 'Invalid server configuration' });
  }

  const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');

  if (checkHash === hash) {
    const { token, expiresAt } = generateToken();
    setHeaders(corsHeaders);
    res.json({ token, expiresAt });
  } else {
    setHeaders(corsHeaders);
    res.status(401).json({ error: 'Invalid password' });
  }
}
