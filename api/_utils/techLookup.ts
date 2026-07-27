/**
 * Tech-stack detection — single source of truth for the `/api/tech-detect`
 * endpoint and the dev proxy. Fetches the page HTML + a couple of headers and
 * defers parsing to `parseTechFromHTML`.
 *
 * SSRF-guarded: the URL is resolved + validated (every A/AAAA must be public)
 * before any request, same as the other outbound-fetching endpoints.
 */
import * as https from 'https';
import { validateOutboundUrlResolved } from './ssrfGuard.js';
import { parseTechFromHTML } from '../../services/techDetectionService.js';

export async function detectTechStack(rawUrl: string): Promise<unknown> {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  const v = await validateOutboundUrlResolved(url);
  if (!v.ok) throw new Error(v.reason);

  const pinnedIp = v.addresses[0];
  if (!pinnedIp) throw new Error('Host did not resolve');

  const parsed = new URL(url);
  const family = pinnedIp.includes(':') ? 6 : 4;
  const port = parsed.port ? parseInt(parsed.port, 10) : 443;

  return new Promise((resolve, reject) => {
    const req = https.get({
      hostname: pinnedIp,
      port,
      path: `${parsed.pathname}${parsed.search}`,
      headers: { Host: parsed.host },
      servername: parsed.hostname,
      timeout: 10000,
      lookup: (_hostname, _options, callback) => callback(null, pinnedIp, family),
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const headers: Record<string, string> = {};
          if (res.headers['x-powered-by']) headers['x-powered-by'] = res.headers['x-powered-by'] as string;
          if (res.headers['server']) headers['server'] = res.headers['server'] as string;
          resolve(parseTechFromHTML(data, headers));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}
