/**
 * SSL certificate lookup — single source of truth for the `/api/ssl` endpoint
 * and the dev proxy. Do not reimplement cert parsing elsewhere.
 *
 * rejectUnauthorized is false so we still retrieve invalid/expired certs;
 * validity is judged from the cert dates, not the TLS handshake.
 */
import * as https from 'https';
import * as tls from 'tls';
import { validateOutboundUrlResolved } from './ssrfGuard.js';

export interface SSLResult {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  error?: string;
}

/** Strip protocol/path/port from a user-supplied domain string. */
export function normalizeSslHost(domain: string): string {
  const withoutPath = domain.replace(/^https?:\/\//, '').split('/')[0] ?? '';
  return withoutPath.split(':')[0] ?? '';
}

export async function getSSLCertificate(domain: string): Promise<SSLResult> {
  const host = normalizeSslHost(domain);
  const v = await validateOutboundUrlResolved(`https://${host}`);
  if (!v.ok) return { valid: false, error: v.reason };

  const pinnedIp = v.addresses[0];
  if (!pinnedIp) return { valid: false, error: 'Host did not resolve' };

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

      resolve({
        valid: daysUntilExpiry > 0,
        issuer,
        validFrom: validFrom.toISOString(),
        validTo: validTo.toISOString(),
        daysUntilExpiry,
      });
    });

    req.on('error', (error) => resolve({ valid: false, error: error.message }));
    req.on('timeout', () => { req.destroy(); resolve({ valid: false, error: 'Request timeout' }); });
    req.end();
  });
}
