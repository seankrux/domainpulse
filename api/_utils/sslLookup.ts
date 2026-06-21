/**
 * SSL certificate lookup — single source of truth for the `/api/ssl` endpoint
 * and the dev proxy. Do not reimplement cert parsing elsewhere.
 *
 * rejectUnauthorized is false so we still retrieve invalid/expired certs;
 * validity is judged from the cert dates, not the TLS handshake.
 */
import * as https from 'https';
import * as tls from 'tls';

export interface SSLResult {
  valid: boolean;
  issuer?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  error?: string;
}

export function getSSLCertificate(domain: string): Promise<SSLResult> {
  return new Promise((resolve) => {
    const options = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 10000,
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
