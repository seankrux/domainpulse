import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import * as https from 'https';
import * as tls from 'tls';
import * as dns from 'dns';

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

interface CheckResult {
  status: 'ALIVE' | 'DOWN' | 'ERROR';
  statusCode: number;
  latency: number;
  message?: string;
}

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

  const startTime = Date.now();
  const targetUrl = url.startsWith('http') ? url : `https://${url}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'DomainPulse/1.0 (Domain Monitor)'
      }
    });

    clearTimeout(timeoutId);
    const latency = Date.now() - startTime;

    const result: CheckResult = {
      status: response.ok ? 'ALIVE' : 'DOWN',
      statusCode: response.status,
      latency
    };

    res.json(result);
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Determine error type
    let statusCode = 0;
    if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
      statusCode = 408;
    } else if (errorMessage.includes('ENOTFOUND')) {
      statusCode = 0; // DNS failure
    } else if (errorMessage.includes('ECONNREFUSED')) {
      statusCode = 0; // Connection refused
    } else if (errorMessage.includes('abort')) {
      statusCode = 408; // Request timeout
    }

    res.json({
      status: 'DOWN' as const,
      statusCode,
      latency,
      message: errorMessage
    });
  }
});

app.get('/api/ssl', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  try {
    const options = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 10000,
      agent: new https.Agent({ rejectUnauthorized: false })
    };

    const sslReq = https.request(options, (sslRes) => {
      const socket = sslRes.socket as tls.TLSSocket;
      const cert = socket.getPeerCertificate(true);

      if (!cert || Object.keys(cert).length === 0) {
        return res.json({ valid: false, error: 'No certificate found' });
      }

      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const issuer = cert.issuer?.CN || cert.issuer?.O || 'Unknown';

      res.json({
        valid: daysUntilExpiry > 0,
        issuer,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysUntilExpiry
      });
    });

    sslReq.on('error', (e) => res.json({ valid: false, error: e.message }));
    sslReq.on('timeout', () => { sslReq.destroy(); res.json({ valid: false, error: 'Timeout' }); });
    sslReq.end();
  } catch (e) {
    res.json({ valid: false, error: e instanceof Error ? e.message : 'Unknown' });
  }
});

app.get('/api/dns', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  try {
    const resolver = new dns.promises.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']);

    const [a, mx, ns, txt, cname] = await Promise.allSettled([
      resolver.resolve4(domain),
      resolver.resolveMx(domain),
      resolver.resolveNs(domain),
      resolver.resolveTxt(domain),
      resolver.resolveCname(domain).catch(() => [])
    ]);

    res.json({
      a: a.status === 'fulfilled' ? a.value : [],
      mx: mx.status === 'fulfilled' ? mx.value : [],
      ns: ns.status === 'fulfilled' ? ns.value : [],
      txt: txt.status === 'fulfilled' ? txt.value : [],
      cname: cname.status === 'fulfilled' ? cname.value : []
    });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'DNS lookup failed' });
  }
});

app.get('/api/whois', verifyToken, async (req, res) => {
  const domain = req.query.domain as string;
  if (!domain) return res.status(400).json({ error: 'Domain is required' });

  // Simple simulated WHOIS for local proxy
  res.json({
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    registrar: 'Local Simulation Registrar'
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
});
