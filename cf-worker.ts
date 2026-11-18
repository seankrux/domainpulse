import type { ApiRequest } from './api/_utils/httpTypes.js';
import authStatus from './api/auth-status.js';
import login from './api/login.js';
import check from './api/check.js';
import ssl from './api/ssl.js';
import whois from './api/whois.js';
import dns from './api/dns.js';
import gmb from './api/gmb.js';
import techDetect from './api/tech-detect.js';
import canonical from './api/canonical.js';
import emailAuth from './api/email-auth.js';
import securityHeaders from './api/security-headers.js';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  SSL_ORIGIN_TOKEN?: string;
}

const handlers = {
  '/api/auth-status': authStatus,
  '/api/login': login,
  '/api/check': check,
  '/api/ssl': ssl,
  '/api/whois': whois,
  '/api/dns': dns,
  '/api/gmb': gmb,
  '/api/tech-detect': techDetect,
  '/api/canonical': canonical,
  '/api/email-auth': emailAuth,
  '/api/security-headers': securityHeaders,
};

const security = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
};

class ApiResponse {
  private code = 200;
  private headers = new Headers(security);
  private response?: Response;

  setHeader(name: string, value: string): void { this.headers.set(name, value); }
  status(code: number): this { this.code = code; return this; }
  json(value: unknown): this {
    this.headers.set('Content-Type', 'application/json');
    this.response = new Response(JSON.stringify(value), { status: this.code, headers: this.headers });
    return this;
  }
  end(): this {
    this.response = new Response(null, { status: this.code, headers: this.headers });
    return this;
  }
  result(): Response {
    return this.response ?? new Response(null, { status: 500, headers: this.headers });
  }
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const handler = handlers[url.pathname as keyof typeof handlers];
      if (!handler) return Response.json({ error: 'Not found' }, { status: 404, headers: security });
      let body: Record<string, unknown> = {};
      if (request.method === 'POST') {
        try {
          const parsed: unknown = await request.json();
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid JSON object');
          body = parsed as Record<string, unknown>;
        }
        catch { return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: security }); }
      }
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const headers = Object.fromEntries(request.headers.entries());
      headers['x-forwarded-for'] = ip;
      const apiRequest: ApiRequest = {
        method: request.method,
        headers,
        query: Object.fromEntries(url.searchParams.entries()),
        body,
        socket: { remoteAddress: ip },
      };
      const response = new ApiResponse();
      try {
        await handler(apiRequest, response);
        return response.result();
      } catch (error) {
        console.error('API request failed', url.pathname, error instanceof Error ? error.name : 'Unknown error');
        return Response.json({ error: 'API request failed' }, { status: 500, headers: security });
      }
    }
    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      return env.ASSETS.fetch(new Request(new URL('/app/index.html', request.url), request));
    }
    return env.ASSETS.fetch(request);
  },
};
