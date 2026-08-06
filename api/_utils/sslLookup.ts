/**
 * SSL certificate lookup — single source of truth for the `/api/ssl` endpoint
 * and the dev proxy. Do not reimplement cert parsing elsewhere.
 *
 * Uses a direct TLS HEAD with SSRF-pinned DNS lookup. We intentionally do NOT
 * enable ssl-checker's `grade: true` — those extra protocol probes call
 * `tls.connect({ host })` without our pinned `lookup`, which reopens
 * DNS-rebinding TOCTOU.
 *
 * rejectUnauthorized is false so we still retrieve invalid/expired certs;
 * validity is judged from the cert dates, not the TLS handshake.
 */
import * as https from 'https';
import * as tls from 'tls';
import sslChecker from 'ssl-checker';
import { validateOutboundUrlResolved } from './ssrfGuard.js';

export interface SSLResult {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  protocol?: string;
  cipher?: string;
  fingerprint256?: string;
  grade?: string;
  error?: string;
}

/** Strip protocol/path/port from a user-supplied domain string. */
export function normalizeSslHost(domain: string): string {
  const withoutPath = domain.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  return withoutPath.split(':')[0] ?? '';
}

/**
 * ssl-checker without `grade` — the leaf handshake honors our pinned lookup.
 * Grade probes are omitted (they re-resolve DNS).
 */
async function viaSslChecker(host: string, pinnedIp: string): Promise<SSLResult | null> {
  const family = pinnedIp.includes(':') ? 6 : 4;
  try {
    const result = await sslChecker(host, {
      timeout: 10000,
      validateSubjectAltName: true,
      servername: host,
      lookup: (_hostname: string, _options: unknown, callback: (err: Error | null, address: string, family: number) => void) => {
        callback(null, pinnedIp, family);
      },
    });

    const validTo = new Date(result.validTo);
    const validFrom = new Date(result.validFrom);
    if (isNaN(validTo.getTime()) || isNaN(validFrom.getTime())) return null;

    const daysUntilExpiry = typeof result.daysRemaining === 'number'
      ? result.daysRemaining
      : Math.ceil((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    const issuer = result.issuer?.CN || result.issuer?.O || 'Unknown';

    return {
      valid: result.valid && daysUntilExpiry > 0,
      issuer,
      validFrom: validFrom.toISOString(),
      validTo: validTo.toISOString(),
      daysUntilExpiry,
      protocol: result.protocol,
      cipher: result.cipher,
      fingerprint256: result.fingerprint256,
      error: result.validationError || undefined,
    };
  } catch {
    return null;
  }
}

function viaDirectTls(host: string, pinnedIp: string): Promise<SSLResult> {
  const family = pinnedIp.includes(':') ? 6 : 4;

  return new Promise((resolve) => {
    const options = {
      hostname: pinnedIp,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 10000,
      servername: host,
      lookup: (_hostname: string, _options: unknown, callback: (err: Error | null, address: string, family: number) => void) => {
        callback(null, pinnedIp, family);
      },
      agent: new https.Agent({ rejectUnauthorized: false }),
    };

    const req = https.request(options, (res) => {
      const socket = res.socket as tls.TLSSocket;
      const cert = socket.getPeerCertificate(true);

      if (!cert || Object.keys(cert).length === 0) {
        resolve({ valid: false, error: 'No certificate found' });
        return;
      }

      const validFrom = new Date(cert.valid_from);
      const validTo = new Date(cert.valid_to);
      if (isNaN(validFrom.getTime()) || isNaN(validTo.getTime())) {
        resolve({ valid: false, error: 'Invalid certificate dates' });
        return;
      }

      const now = new Date();
      const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const issuer = cert.issuer?.CN || cert.issuer?.O || 'Unknown';
      const cipher = socket.getCipher();

      resolve({
        valid: daysUntilExpiry > 0,
        issuer,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysUntilExpiry,
        protocol: socket.getProtocol() || undefined,
        cipher: cipher?.name,
        fingerprint256: cert.fingerprint256,
      });
    });

    req.on('error', (error) => resolve({ valid: false, error: error.message }));
    req.on('timeout', () => { req.destroy(); resolve({ valid: false, error: 'Request timeout' }); });
    req.end();
  });
}

export async function getSSLCertificate(domain: string): Promise<SSLResult> {
  const host = normalizeSslHost(domain);
  const v = await validateOutboundUrlResolved(`https://${host}`);
  if (!v.ok) return { valid: false, error: v.reason };

  const pinnedIp = v.addresses[0];
  if (!pinnedIp) return { valid: false, error: 'Host did not resolve' };

  const enriched = await viaSslChecker(host, pinnedIp);
  if (enriched) return enriched;

  return viaDirectTls(host, pinnedIp);
}
