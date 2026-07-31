import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { generateToken, verifyAuthHeader } from '../api/_utils/auth.js';
import { config } from '../lib/config.js';

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
const ALLOW_INITIAL_LOGIN = process.env.VITE_ALLOW_INITIAL_LOGIN === 'true';

// CORS allowlist: the proxy makes outbound requests on the caller's behalf,
// so an open policy would let any web page a developer visits use it as an
// SSRF springboard. Only the local dev/preview origins (plus ALLOWED_ORIGINS
// for custom setups) may call it from a browser.
const allowedOrigins = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [])
]);

app.use(cors({
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Rate limit all /api routes (CodeQL-recognized + dev/prod parity with Vercel fns).
const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded', message: 'Too many requests. Please wait a minute.' },
});
app.use('/api', apiRateLimiter);

// Middleware to verify auth token (JWT — matches production api/login.ts)
const verifyToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!verifyAuthHeader(req.headers.authorization)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
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
    console.log('Initial password set. Save VITE_PASSWORD_HASH in .env.local for production.');
    const { token, expiresAt } = generateToken();
    return res.json({ token, expiresAt, message: 'Password initialized' });
  }

  const [hash, salt] = AUTH_PASSWORD_HASH.split(':');
  if (!hash || !salt) {
    return res.status(500).json({ error: 'Invalid server configuration' });
  }

  const checkHash = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');

  const hashesMatch = checkHash.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(checkHash, 'hex'), Buffer.from(hash, 'hex'));
  if (hashesMatch) {
    const { token, expiresAt } = generateToken();
    res.json({ token, expiresAt });
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
  const userAgent = (req.query.ua as string) || 'DomainPulse/1.0 (Domain Monitor)';
  const rawTimeout = parseInt(req.query.timeout as string, 10);
  const timeoutMs = isNaN(rawTimeout) ? 10000 : Math.min(Math.max(rawTimeout, 5000), 30000);

  const { probeUptime } = await import('../api/_utils/ssrfGuard');
  const { httpStatus, body } = await probeUptime(targetUrl, { timeoutMs, userAgent });
  res.status(httpStatus).json(body);
});

app.get('/api/ssl', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  const { isBlockedHost } = await import('../api/_utils/ssrfGuard');
  const { getSSLCertificate, normalizeSslHost } = await import('../api/_utils/sslLookup');
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const normalizedHost = normalizeSslHost(domain);
  if (isBlockedHost(normalizedHost)) {
    return res.status(400).json({ error: 'Blocked: private/internal host not allowed' });
  }

  res.json(await getSSLCertificate(normalizedHost));
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
    res.status(200).json({ error: e instanceof Error ? e.message : 'DNS lookup failed' });
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

app.get('/api/tech-detect', verifyToken, async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const { detectTechStack } = await import('../api/_utils/techLookup');
    res.json(await detectTechStack(url));
  } catch (e) {
    res.status(200).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
});

app.get('/api/canonical', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const { isBlockedHost } = await import('../api/_utils/ssrfGuard');
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase();
  if (isBlockedHost(cleanDomain)) {
    return res.status(400).json({ error: 'Blocked: private/internal host not allowed' });
  }

  const userAgent = (req.query.ua as string) || 'DomainPulse/1.0 (Domain Monitor)';
  const timeoutMs = Math.min(Math.max(parseInt(req.query.timeout as string, 10) || 10000, 5000), 30000);

  try {
    const { checkCanonicalVariants } = await import('../api/_utils/canonicalLookup');
    res.json(await checkCanonicalVariants(cleanDomain, { timeoutMs, userAgent }));
  } catch (e) {
    res.status(200).json({
      status: 'unknown',
      variants: [],
      issues: [e instanceof Error ? e.message : 'Unknown error'],
      httpsEnforced: false,
      wwwConsistent: false,
    });
  }
});

app.get('/api/email-auth', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const { isBlockedHost } = await import('../api/_utils/ssrfGuard');
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase();
  if (isBlockedHost(cleanDomain)) {
    return res.status(400).json({ error: 'Blocked: private/internal host not allowed' });
  }

  try {
    const { getEmailAuthInfo } = await import('../api/_utils/emailAuthLookup');
    res.json(await getEmailAuthInfo(cleanDomain));
  } catch (e) {
    res.status(200).json({
      grade: 'F',
      spf: { present: false },
      dkim: { present: false },
      dmarc: { present: false },
      issues: [e instanceof Error ? e.message : 'Unknown error'],
    });
  }
});

app.get('/api/security-headers', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  const { isBlockedHost } = await import('../api/_utils/ssrfGuard');
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0]!.toLowerCase();
  if (isBlockedHost(cleanDomain)) {
    return res.status(400).json({ error: 'Blocked: private/internal host not allowed' });
  }

  const userAgent = (req.query.ua as string) || 'DomainPulse/1.0 (Domain Monitor)';

  try {
    const { getSecurityHeadersInfo } = await import('../api/_utils/securityHeadersLookup');
    res.json(await getSecurityHeadersInfo(cleanDomain, { userAgent }));
  } catch (e) {
    res.status(200).json({
      grade: 'F',
      score: 0,
      maxScore: 100,
      headers: [],
      issues: [e instanceof Error ? e.message : 'Unknown error'],
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
