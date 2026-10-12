import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Route-parity contract (AGENTS.md — "Enrichment endpoints — one implementation each").
 *
 * The dev proxy (server/proxy.ts) and the Vercel functions (api/*.ts) must serve
 * exactly the `/api/*` routes the frontend services call, or a feature silently
 * breaks in dev (or prod). This is a static, filesystem-level guard so drift is
 * caught at test time rather than by a user hitting a 404.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8');

/** `/api/*` endpoints referenced by client services / hooks. */
function frontendEndpoints(): Set<string> {
  const dirs = ['services', 'hooks'];
  const found = new Set<string>();
  const re = /\/api\/[a-z][a-z-]*/g;
  for (const dir of dirs) {
    const abs = path.join(ROOT, dir);
    for (const file of readdirSync(abs)) {
      if (!/\.(ts|tsx)$/.test(file)) continue;
      for (const match of read(path.join(dir, file)).matchAll(re)) {
        found.add(match[0]);
      }
    }
  }
  return found;
}

/** `/api/*` routes registered in the dev proxy. */
function proxyRoutes(): Set<string> {
  const src = read('server/proxy.ts');
  const found = new Set<string>();
  for (const match of src.matchAll(/app\.(?:get|post|put|delete)\(\s*'(\/api\/[a-z][a-z-]*)'/g)) {
    if (match[1]) found.add(match[1]);
  }
  return found;
}

/** `/api/*` routes backed by a Vercel function file. */
function vercelRoutes(): Set<string> {
  const apiDir = path.join(ROOT, 'api');
  const found = new Set<string>();
  for (const file of readdirSync(apiDir)) {
    if (!file.endsWith('.ts')) continue;
    if (file === '_utils') continue;
    found.add(`/api/${file.replace(/\.ts$/, '')}`);
  }
  // Auth endpoints are always available on both sides.
  found.add('/api/auth-status');
  found.add('/api/login');
  return found;
}

describe('dev/prod route parity', () => {
  it('the dev proxy serves every endpoint the frontend calls', () => {
    const missing = [...frontendEndpoints()].filter((e) => !proxyRoutes().has(e));
    expect(missing, `proxy is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('every endpoint the frontend calls has a Vercel function', () => {
    const missing = [...frontendEndpoints()].filter((e) => !vercelRoutes().has(e));
    expect(missing, `Vercel api/ is missing: ${missing.join(', ')}`).toEqual([]);
  });

  it('the dev proxy and Vercel functions expose the same /api/* routes', () => {
    const proxy = proxyRoutes();
    const vercel = vercelRoutes();
    expect([...proxy].sort()).toEqual([...vercel].sort());
  });

  it('each outbound endpoint has a single shared lookup util', () => {
    // Endpoints that make outbound calls must delegate to api/_utils, never
    // reimplement the lookup inline (prod/dev drift). gmb/tech/canonical/etc.
    const sharedUtilByEndpoint: Record<string, string> = {
      '/api/check': 'api/_utils/ssrfGuard.ts',
      '/api/tech-detect': 'api/_utils/techLookup.ts',
      '/api/security-headers': 'api/_utils/securityHeadersLookup.ts',
      '/api/ssl': 'api/_utils/sslLookup.ts',
      '/api/dns': 'api/_utils/dnsLookup.ts',
      '/api/whois': 'api/_utils/whoisLookup.ts',
      '/api/gmb': 'api/_utils/gmbLookup.ts',
      '/api/canonical': 'api/_utils/canonicalLookup.ts',
      '/api/email-auth': 'api/_utils/emailAuthLookup.ts',
    };
    for (const [endpoint, util] of Object.entries(sharedUtilByEndpoint)) {
      // The util must exist...
      expect(() => read(util), `${util} must exist`).not.toThrow();
      // ...and BOTH the Vercel function and the proxy must reference it.
      const fn = read(`api/${endpoint.replace('/api/', '')}.ts`);
      const proxy = read('server/proxy.ts');
      const utilModule = util.replace('api/_utils/', '').replace(/\.ts$/, '');
      expect(fn, `${endpoint} function must use ${utilModule}`).toContain(utilModule);
      expect(proxy, `proxy must use ${utilModule}`).toContain(utilModule);
    }
  });
});
