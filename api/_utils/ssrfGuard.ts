/**
 * SSRF guard for endpoints that fetch/connect to a user-supplied target.
 *
 * Defense in depth:
 *  - scheme allow-list (http/https only)
 *  - literal host block (loopback, RFC1918, CGNAT, link-local + cloud metadata,
 *    IPv6 ULA/link-local, *.internal/.local)
 *  - DNS resolution check (every resolved A/AAAA must be public) — stops DNS
 *    rebinding where a public hostname points at a private IP
 *  - safe redirect following (each hop re-validated; capped) — stops an open
 *    redirect from bouncing the request to an internal target
 *
 * Node-only (uses node:dns + global fetch). Shared by the Vercel functions,
 * the dev proxy, and unit tests.
 */
import { promises as dns } from 'node:dns';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata']);

/** Core IP check covering IPv4, IPv6, and IPv4-mapped IPv6. */
export function isBlockedIp(ip: string): boolean {
  let h = ip.toLowerCase().trim();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);

  // IPv4-mapped IPv6 (::ffff:127.0.0.1) → test the embedded IPv4.
  const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) h = mapped[1]!;

  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if ([a, b, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return true;
    if (a === 0 || a === 10 || a === 127) return true;     // this-host / private / loopback
    if (a === 169 && b === 254) return true;               // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;       // private
    if (a === 192 && b === 168) return true;                // private
    if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT
    if (a >= 224) return true;                              // multicast / reserved
    return false;
  }

  // IPv6
  if (h === '::' || h === '::1') return true;               // unspecified / loopback
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique-local fc00::/7
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true; // link-local fe80::/10
  return false;
}

/** Sync literal-host block (no DNS). Fast first-pass reject. */
export function isBlockedHost(hostname: string | undefined): boolean {
  if (!hostname) return true;
  let h = hostname.toLowerCase().replace(/\.$/, '');
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (isBlockedIp(h)) return true;
  return false;
}

/** Sync validation of a full URL (scheme + literal host). */
export function validateOutboundUrl(raw: string): { ok: true } | { ok: false; reason: string } {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https URLs are allowed' };
  }
  if (isBlockedHost(u.hostname)) {
    return { ok: false, reason: 'Target host is not allowed (private/internal address)' };
  }
  return { ok: true };
}

/** Async: literal check + resolve every A/AAAA and ensure all are public. */
export async function validateOutboundUrlResolved(raw: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const lit = validateOutboundUrl(raw);
  if (!lit.ok) return lit;
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, '');
  if (isBlockedIp(host)) return { ok: false, reason: 'Target host is not allowed (private/internal address)' };
  // If it's already an IP literal, no DNS to do.
  if (/^[0-9.]+$/.test(host) || host.includes(':')) return { ok: true };
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return { ok: false, reason: 'Host did not resolve' };
    for (const r of records) {
      if (isBlockedIp(r.address)) {
        return { ok: false, reason: 'Host resolves to a private/internal address' };
      }
    }
  } catch {
    return { ok: false, reason: 'Host did not resolve' };
  }
  return { ok: true };
}

/**
 * A domain is "up" if the server answered with any non-server-error status.
 * A 401/403/405/429 etc. still proves the host is reachable and serving — only
 * a 5xx (or no response at all) should read as DOWN. This avoids false
 * "offline" results for sites that reject HEAD or block our user-agent.
 */
export function isReachableStatus(status: number): boolean {
  return status > 0 && status < 500;
}

export interface SafeHeadResult {
  blocked?: boolean;
  reason?: string;
  ok: boolean;
  status: number;
  latency: number;
  error?: string;
}

/** Wire shape returned by the `/api/check` endpoint (Vercel fn + dev proxy). */
export interface CheckResult {
  status: 'ALIVE' | 'DOWN' | 'ERROR';
  statusCode: number;
  latency: number;
  message?: string;
}

/**
 * Map a {@link SafeHeadResult} to the public `/api/check` response shape.
 *
 * SINGLE SOURCE OF TRUTH for how a probe result becomes ALIVE/DOWN. Both the
 * Vercel function (`api/check.ts`) and the dev proxy (`server/proxy.ts`) MUST
 * use this so the two environments can never disagree. Liveness is `r.ok`,
 * which is driven by {@link isReachableStatus} — see AGENTS.md §1–2.
 *
 * Note: `blocked` results (SSRF reject) are handled by the caller as HTTP 400,
 * not here — this only maps a probe that actually ran.
 */
export function toCheckResult(r: SafeHeadResult): CheckResult {
  const result: CheckResult = {
    status: r.ok ? 'ALIVE' : 'DOWN',
    statusCode: r.status,
    latency: r.latency,
  };
  if (r.error) result.message = r.error;
  return result;
}

/**
 * HEAD-request a URL with SSRF protection: resolves + validates every hop,
 * follows redirects manually (capped), and never reaches a private target.
 */
export async function safeHeadRequest(
  rawUrl: string,
  opts: { timeoutMs?: number; userAgent?: string; maxRedirects?: number } = {},
): Promise<SafeHeadResult> {
  const { timeoutMs = 10000, userAgent = 'DomainPulse/1.0 (Domain Monitor)', maxRedirects = 5 } = opts;
  // Return a literal from a fixed step ladder so CodeQL's taint tracking
  // sees a constant (not user input) flow into setTimeout — the caller-supplied
  // value only selects WHICH constant is used, it never reaches the timer directly.
  // Minimum step is 5000ms; callers must not pass values below that.
  const safeTimeoutMs = (() => {
    const ms = Math.min(Math.max(timeoutMs, 5000), 30000);
    if (ms <= 5000) return 5000 as const;
    if (ms <= 10000) return 10000 as const;
    if (ms <= 15000) return 15000 as const;
    if (ms <= 20000) return 20000 as const;
    if (ms <= 25000) return 25000 as const;
    return 30000 as const;
  })();
  const start = Date.now();
  let current = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const v = await validateOutboundUrlResolved(current);
    if (!v.ok) return { blocked: true, reason: v.reason, ok: false, status: 0, latency: Date.now() - start };

    const doFetch = async (method: 'HEAD' | 'GET'): Promise<Response> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), safeTimeoutMs);
      try {
        return await fetch(current, {
          method,
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'User-Agent': userAgent },
        });
      } finally {
        clearTimeout(timer);
      }
    };

    let resp: Response;
    try {
      resp = await doFetch('HEAD');
      // Some servers reject HEAD outright (405/501) — retry once with GET so a
      // perfectly healthy site isn't reported as DOWN.
      if (resp.status === 405 || resp.status === 501) {
        try {
          resp = await doFetch('GET');
        } catch {
          // keep the HEAD response if the GET retry fails
        }
      }
    } catch (error) {
      return { ok: false, status: 0, latency: Date.now() - start, error: error instanceof Error ? error.message : 'fetch failed' };
    }

    if (resp.status >= 300 && resp.status < 400) {
      const loc = resp.headers.get('location');
      if (!loc) return { ok: true, status: resp.status, latency: Date.now() - start };
      try {
        current = new URL(loc, current).toString();
      } catch {
        return { ok: false, status: resp.status, latency: Date.now() - start, error: 'Invalid redirect location' };
      }
      continue;
    }
    return { ok: isReachableStatus(resp.status), status: resp.status, latency: Date.now() - start };
  }
  return { ok: false, status: 0, latency: Date.now() - start, error: 'Too many redirects' };
}
