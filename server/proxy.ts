import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Manual env loading for local dev stability
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8');
    env.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=');
      if (key && value && !process.env[key.trim()]) {
        process.env[key.trim()] = value.trim();
      }
    });
  }
} catch {
  console.log('No .env.local found or error reading it');
}

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

let AUTH_PASSWORD_HASH = process.env.VITE_PASSWORD_HASH || '';
const SESSION_TTL_MINUTES = Number(process.env.VITE_AUTH_SESSION_TTL_MINUTES || 720); // 12h
const ALLOW_INITIAL_LOGIN = process.env.VITE_ALLOW_INITIAL_LOGIN === 'true';

app.use(cors());
app.use(express.json());

// Simple in-memory rate limiter for /api/* (dev proxy parity with the
// Vercel functions' rate limiting).
const rlMap = new Map<string, { count: number; reset: number }>();
const RL_MAX = 120;
const RL_WINDOW_MS = 60_000;
app.use('/api', (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const rec = rlMap.get(ip);
  if (!rec || rec.reset < now) {
    rlMap.set(ip, { count: 1, reset: now + RL_WINDOW_MS });
    return next();
  }
  rec.count += 1;
  if (rec.count > RL_MAX) {
    return res.status(429).json({ error: 'Rate limit exceeded', message: 'Too many requests. Please wait a minute.' });
  }
  next();
});

// Middleware to verify auth token
const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // If no password is set, allow all (dev mode)
  if (!AUTH_PASSWORD_HASH) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  // Simple token verification: in this app, the token IS the hash for simplicity
  if (token === AUTH_PASSWORD_HASH.split(':')[0]) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Auth Endpoint
app.post('/api/login', async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // If no hash is set, the first login "sets" the password (dev mode behavior)
  if (!AUTH_PASSWORD_HASH) {
    if (!ALLOW_INITIAL_LOGIN) {
      return res.status(500).json({ error: 'AUTH password hash not configured.' });
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
    AUTH_PASSWORD_HASH = `${hash}:${salt}`;
    console.log('Initial password set. Please save this hash for production:', AUTH_PASSWORD_HASH);
    const expiresAt = Date.now() + Math.max(SESSION_TTL_MINUTES, 1) * 60 * 1000;
    return res.json({ token: hash, expiresAt, message: 'Password initialized' });
  }

  const [hash, salt] = AUTH_PASSWORD_HASH.split(':');
  if (!hash || !salt) {
    return res.status(500).json({ error: 'Invalid server configuration' });
  }

  const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');

  if (checkHash === hash) {
    const expiresAt = Date.now() + Math.max(SESSION_TTL_MINUTES, 1) * 60 * 1000;
    res.json({ token: hash, expiresAt });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.get('/api/check', verifyToken, async (req, res) => {
  const url = req.query.url as string;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  const { safeHeadRequest, toCheckResult } = await import('../api/_utils/ssrfGuard');
  const r = await safeHeadRequest(targetUrl, { timeoutMs: 10000 });
  if (r.blocked) {
    return res.status(400).json({ error: 'Blocked', message: r.reason });
  }
  res.json(toCheckResult(r));
});

app.get('/api/ssl', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  const { isBlockedHost } = await import('../api/_utils/ssrfGuard');
  if (domain && isBlockedHost(domain.replace(/^https?:\/\//, '').split('/')[0])) {
    return res.status(400).json({ error: 'Blocked: private/internal host not allowed' });
  }
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const { getSSLCertificate } = await import('../api/_utils/sslLookup');
  res.json(await getSSLCertificate(domain));
});

app.get('/api/dns', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });
  const { isBlockedHost } = await import('../api/_utils/ssrfGuard');
  if (isBlockedHost(domain.replace(/^https?:\/\//, '').split('/')[0])) {
    return res.status(400).json({ error: 'Blocked: private/internal host not allowed' });
  }

  try {
    const { getDNSInfo } = await import('../api/_utils/dnsLookup');
    res.json(await getDNSInfo(domain));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'DNS lookup failed' });
  }
});

app.get('/api/whois', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const { getWhoisInfo } = await import('../api/_utils/whoisLookup');
  res.json(await getWhoisInfo(domain));
});

app.get('/api/gmb', verifyToken, async (req, res) => {
  const placeId = req.query.placeId as string | undefined;
  const query = req.query.query as string | undefined;
  if (!placeId && !query) return res.status(400).json({ error: 'placeId or query is required' });

  const { lookupGmb } = await import('../api/_utils/gmbLookup');
  const result = await lookupGmb({ placeId, query });
  res.json(result);
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
