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

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 10000 }, (res) => {
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
    // Without a 'timeout' handler the request hangs forever on a stalled peer
    // (leaked socket, unresolved promise). Destroy and reject so the caller's
    // soft-timeout isn't the only thing that can end it.
    req.on('timeout', () => { req.destroy(new Error('Tech-detect request timed out')); });
  });
}
