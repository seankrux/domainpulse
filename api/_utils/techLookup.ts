/**
 * Tech-stack detection — single source of truth for the `/api/tech-detect`
 * endpoint and the dev proxy. Fetches the page HTML + a couple of headers and
 * defers parsing to `parseTechFromHTML`.
 *
 * SSRF-guarded: the URL is resolved + validated (every A/AAAA must be public)
 * before any request, same as the other outbound-fetching endpoints.
 */
import http from 'node:http';
import https from 'node:https';
import { validateOutboundUrlResolved } from './ssrfGuard.js';
import { parseTechFromHTML } from '../../services/techDetectionService.js';

const MAX_BODY_BYTES = 512 * 1024;
const MAX_REDIRECTS = 5;

function pinnedGet(
  urlString: string,
  pinnedIp: string,
): Promise<{ status: number; body: string; headers: Record<string, string>; location?: string }> {
  const parsed = new URL(urlString);
  const isHttps = parsed.protocol === 'https:';
  const transport = isHttps ? https : http;
  const port = parsed.port ? parseInt(parsed.port, 10) : (isHttps ? 443 : 80);
  const family = pinnedIp.includes(':') ? 6 : 4;

  return new Promise((resolve, reject) => {
    const req = transport.get({
      hostname: pinnedIp,
      port,
      path: `${parsed.pathname}${parsed.search}`,
      headers: { Host: parsed.host, 'User-Agent': 'DomainPulse/1.0 (Domain Monitor)' },
      servername: parsed.hostname,
      timeout: 10000,
      lookup: (_hostname, _options, callback) => callback(null, pinnedIp, family),
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const locHeader = res.headers.location;
        const location = Array.isArray(locHeader) ? locHeader[0] : locHeader;
        res.resume();
        res.on('end', () => resolve({ status, body: '', headers: {}, location }));
        return;
      }

      let body = '';
      let bytes = 0;
      res.on('data', (chunk: Buffer | string) => {
        const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        bytes += buf.length;
        if (bytes > MAX_BODY_BYTES) {
          req.destroy();
          return;
        }
        body += buf.toString();
      });
      res.on('end', () => {
        const headers: Record<string, string> = {};
        if (res.headers['x-powered-by']) headers['x-powered-by'] = res.headers['x-powered-by'] as string;
        if (res.headers['server']) headers['server'] = res.headers['server'] as string;
        resolve({ status, body, headers });
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

export async function detectTechStack(rawUrl: string): Promise<unknown> {
  let current = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const v = await validateOutboundUrlResolved(current);
    if (!v.ok) throw new Error(v.reason);

    const pinnedIp = v.addresses[0];
    if (!pinnedIp) throw new Error('Host did not resolve');

    const { status, body, headers, location } = await pinnedGet(current, pinnedIp);

    if (status >= 300 && status < 400 && location) {
      try {
        current = new URL(location, current).toString();
        continue;
      } catch {
        throw new Error('Invalid redirect location');
      }
    }

    return parseTechFromHTML(body, headers);
  }

  throw new Error('Too many redirects');
}
