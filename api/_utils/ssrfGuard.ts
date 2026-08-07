/**
 * SSRF guard for endpoints that fetch/connect to a user-supplied target.
 *
 * Defense in depth:
 *  - scheme allow-list (http/https only)
 *  - literal host block (loopback, RFC1918, CGNAT, link-local + cloud metadata,
 *    IPv6 ULA/link-local, *.internal/.local)
 *  - DNS resolution check (every resolved A/AAAA must be public) — stops DNS
 *    rebinding where a public hostname points at a private IP
 *  - IP pinning: validated addresses are wired into the transport lookup so a
 *    TTL swap between validation and connect cannot redirect to a private IP
 *  - safe redirect following (each hop re-validated; capped) — stops an open
 *    redirect from bouncing the request to an internal target
 *
 * Node-only (uses node:dns + global fetch). Shared by the Vercel functions,
 * the dev proxy, and unit tests.
 */
import { promises as dns } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata']);

/** Range check on the four octets of an IPv4 address. */
function isBlockedIpv4Octets(a: number, b: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true;      // this-host / private / loopback
  if (a === 169 && b === 254) return true;                // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;        // private
  if (a === 192 && b === 168) return true;                 // private
  if (a === 100 && b >= 64 && b <= 127) return true;       // CGNAT
  if (a >= 224) return true;                               // multicast / reserved
  return false;
}

/**
 * Parse an IPv4 address in any `inet_aton` form the C resolver accepts:
 * dotted-quad, but also short forms (`127.1`, `10.1`), and decimal/octal/hex
 * octets (`2130706433`, `0177.0.0.1`, `0x7f.1`). Returns the 32-bit address,
 * or null if the string isn't a numeric IPv4 (i.e. it's a real hostname).
 *
 * This matters for SSRF: `getaddrinfo` turns `http://2130706433` into
 * 127.0.0.1, so the guard must recognise these forms too — the old
 * dotted-quad-only regex let them straight through.
 */
function parseIpv4Aton(h: string): number | null {
  const parts = h.split('.');
  if (parts.length === 0 || parts.length > 4) return null;
  const nums: number[] = [];
  for (const p of parts) {
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(p)) n = parseInt(p.slice(2), 16);
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8);
    else if (/^(0|[1-9][0-9]*)$/.test(p)) n = parseInt(p, 10);
    else return null;                     // non-numeric label → it's a hostname
    if (!Number.isFinite(n) || n < 0) return null;
    nums.push(n);
  }
  // inet_aton: the final part fills all remaining low-order bytes.
  const n = nums.length;
  const maxLast = 2 ** (8 * (4 - (n - 1))) - 1;
  if (nums.slice(0, n - 1).some((x) => x > 255) || nums[n - 1]! > maxLast) return null;
  let addr = nums[n - 1]!;
  for (let i = 0; i < n - 1; i++) addr += nums[i]! * 2 ** (8 * (3 - i));
  return addr >>> 0;
}

/** Expand any textual IPv6 address to its 8 16-bit groups, or null. */
function ipv6Groups(input: string): number[] | null {
  let h = input.split('%')[0]!;          // strip zone id
  // Embedded IPv4 tail (::ffff:127.0.0.1) → fold into two hextets.
  if (h.includes('.')) {
    const idx = h.lastIndexOf(':');
    if (idx === -1) return null;
    const v4 = parseIpv4Aton(h.slice(idx + 1));
    if (v4 === null) return null;
    h = `${h.slice(0, idx + 1)}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = h.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(':') : []) : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill('0'), ...tail];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;
  const out = groups.map((g) => (g === '' ? NaN : parseInt(g, 16)));
  if (out.some((v) => !Number.isInteger(v) || v < 0 || v > 0xffff)) return null;
  return out;
}

/** Core IP check covering all IPv4 (inet_aton) and IPv6 encodings. */
export function isBlockedIp(ip: string): boolean {
  let h = ip.toLowerCase().trim();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  h = h.split('%')[0]!;

  if (h.includes(':')) {
    const g = ipv6Groups(h);
    if (!g) return false;
    if (g.every((n) => n === 0)) return true;                       // :: unspecified
    if (g.slice(0, 7).every((n) => n === 0) && g[7] === 1) return true; // ::1 loopback
    // IPv4-mapped ::ffff:0:0/96 and deprecated IPv4-compatible ::/96 → test embedded IPv4
    const mapped = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff;
    const compat = g.slice(0, 6).every((n) => n === 0) && !(g[6] === 0 && g[7]! <= 1);
    if (mapped || compat) {
      return isBlockedIpv4Octets((g[6]! >>> 8) & 0xff, g[6]! & 0xff);
    }
    if ((g[0]! & 0xfe00) === 0xfc00) return true;   // fc00::/7 unique-local
    if ((g[0]! & 0xffc0) === 0xfe80) return true;   // fe80::/10 link-local
    return false;
  }

  const addr = parseIpv4Aton(h);
  if (addr === null) return false;
  return isBlockedIpv4Octets((addr >>> 24) & 0xff, (addr >>> 16) & 0xff);
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

/**
 * Failure `code` distinguishes a genuinely dead target (`unresolvable` — DNS
 * NXDOMAIN, a real DOWN signal) from an SSRF/scheme rejection (`blocked` /
 * `invalid` — must surface as HTTP 400, never as a domain's DOWN status).
 */
export type ResolveResult =
  | { ok: true; addresses: string[] }
  | { ok: false; reason: string; code: 'unresolvable' | 'blocked' | 'invalid' };

/** Async: literal check + resolve every A/AAAA and ensure all are public. */
export async function validateOutboundUrlResolved(raw: string): Promise<ResolveResult> {
  const lit = validateOutboundUrl(raw);
  if (!lit.ok) return { ...lit, code: lit.reason === 'Invalid URL' ? 'invalid' : 'blocked' };
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, '');
  if (isBlockedIp(host)) return { ok: false, reason: 'Target host is not allowed (private/internal address)', code: 'blocked' };
  // Only skip DNS for a CANONICAL IP literal (isBlockedIp already cleared it).
  // Non-canonical numeric forms (127.1, 2130706433, 0177.0.0.1) are not valid
  // per isIP(), so they fall through to dns.lookup, whose getaddrinfo
  // normalises them to the real address — which isBlockedIp then blocks.
  if (isIP(host) !== 0) return { ok: true, addresses: [host] };
  try {
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return { ok: false, reason: 'Host did not resolve', code: 'unresolvable' };
    const addresses: string[] = [];
    for (const r of records) {
      if (isBlockedIp(r.address)) {
        return { ok: false, reason: 'Host resolves to a private/internal address', code: 'blocked' };
      }
      addresses.push(r.address);
    }
    return { ok: true, addresses };
  } catch {
    return { ok: false, reason: 'Host did not resolve', code: 'unresolvable' };
  }
}

/** Pin a validated address into the transport so DNS rebinding cannot swap targets mid-request. */
async function pinnedRequest(
  urlString: string,
  pinnedIp: string,
  opts: { method: 'HEAD' | 'GET'; timeoutMs: number; userAgent: string },
): Promise<{ status: number; headers: http.IncomingHttpHeaders }> {
  const u = new URL(urlString);
  const isHttps = u.protocol === 'https:';
  const transport = isHttps ? https : http;
  const defaultPort = isHttps ? 443 : 80;
  const port = u.port ? parseInt(u.port, 10) : defaultPort;
  const family = pinnedIp.includes(':') ? 6 : 4;

  return new Promise((resolve, reject) => {
    const req = transport.request({
      hostname: pinnedIp,
      port,
      path: `${u.pathname}${u.search}`,
      method: opts.method,
      headers: {
        Host: u.host,
        'User-Agent': opts.userAgent,
      },
      servername: u.hostname,
      lookup: (_hostname, _options, callback) => callback(null, pinnedIp, family),
      timeout: opts.timeoutMs,
    }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
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
  /** True when `blocked` is due to DNS non-resolution (a real DOWN), not SSRF. */
  unresolvable?: boolean;
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
  // Map caller-supplied timeout to a fixed literal so CodeQL's taint tracker
  // sees only constants flowing into setTimeout — user input selects which
  // constant is used but never reaches the timer argument directly.
  const safeTimeoutMs = (() => {
    const ms = Math.min(Math.max(timeoutMs, 5000), 30000);
    if (ms <= 5000)  return 5000;
    if (ms <= 10000) return 10000;
    if (ms <= 15000) return 15000;
    if (ms <= 20000) return 20000;
    if (ms <= 25000) return 25000;
    return 30000;
  })();
  const start = Date.now();
  let current = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const v = await validateOutboundUrlResolved(current);
    if (!v.ok) return { blocked: true, unresolvable: v.code === 'unresolvable', reason: v.reason, ok: false, status: 0, latency: Date.now() - start };

    const pinnedIp = v.addresses[0];
    if (!pinnedIp) {
      return { blocked: true, unresolvable: true, reason: 'Host did not resolve', ok: false, status: 0, latency: Date.now() - start };
    }

    const doRequest = async (method: 'HEAD' | 'GET') =>
      pinnedRequest(current, pinnedIp, { method, timeoutMs: safeTimeoutMs, userAgent });

    let resp: { status: number; headers: http.IncomingHttpHeaders };
    try {
      resp = await doRequest('HEAD');
      // Some servers reject HEAD outright (405/501) — retry once with GET so a
      // perfectly healthy site isn't reported as DOWN.
      if (resp.status === 405 || resp.status === 501) {
        try {
          resp = await doRequest('GET');
        } catch {
          // keep the HEAD response if the GET retry fails
        }
      }
    } catch (error) {
      return { ok: false, status: 0, latency: Date.now() - start, error: error instanceof Error ? error.message : 'request failed' };
    }

    if (resp.status >= 300 && resp.status < 400) {
      const locHeader = resp.headers.location;
      const loc = Array.isArray(locHeader) ? locHeader[0] : locHeader;
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

/**
 * Return the same URL with its `www.` toggled — strip it if present, add it if
 * absent — or null if the host isn't a plain domain we should toggle. Used to
 * recover a domain the user typed in the "wrong" canonical form (apex vs www).
 */
export function toggleWww(rawUrl: string): string | null {
  let u: URL;
  try { u = new URL(rawUrl); } catch { return null; }
  if (isIP(u.hostname) !== 0) return null;           // never toggle IP literals
  if (u.hostname.startsWith('www.')) {
    u.hostname = u.hostname.slice(4);
  } else {
    u.hostname = `www.${u.hostname}`;
  }
  return u.toString();
}

/**
 * Uptime probe with www↔apex canonicalisation — the single source of truth for
 * `/api/check` (Vercel fn + dev proxy). Returns a ready-to-send HTTP status +
 * body so both endpoints behave identically.
 *
 * Behaviour:
 *  - Probe the URL as given.
 *  - If it fails ONLY because the host doesn't resolve (NXDOMAIN), retry once
 *    with the `www.` toggled — this fixes "I added example.com but it only
 *    serves www.example.com" (and vice-versa).
 *  - A target that still doesn't resolve is reported as DOWN (a real negative
 *    signal about the domain), NOT as a 400/Error. Only an SSRF/scheme reject
 *    (private address, non-http) returns HTTP 400. See AGENTS.md §1–2.
 */
export interface RedirectProbeResult {
  blocked?: boolean;
  reason?: string;
  inputUrl: string;
  finalUrl: string;
  status: number;
  reachable: boolean;
  redirectChain: string[];
  latency: number;
}

/**
 * Follow redirects for a URL and return the full chain. Used by canonical /
 * HTTPS variant checks — enrichment only, never for liveness. SSRF-safe.
 */
export async function probeRedirectChain(
  rawUrl: string,
  opts: { timeoutMs?: number; userAgent?: string; maxRedirects?: number } = {},
): Promise<RedirectProbeResult> {
  const { timeoutMs = 10000, userAgent = 'DomainPulse/1.0 (Domain Monitor)', maxRedirects = 8 } = opts;
  const safeTimeoutMs = Math.min(Math.max(timeoutMs, 5000), 30000);
  const start = Date.now();
  const chain: string[] = [];
  let current = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    chain.push(current);
    const v = await validateOutboundUrlResolved(current);
    if (!v.ok) {
      return {
        blocked: true,
        reason: v.reason,
        inputUrl: rawUrl,
        finalUrl: current,
        status: 0,
        reachable: false,
        redirectChain: chain,
        latency: Date.now() - start,
      };
    }

    const pinnedIp = v.addresses[0];
    if (!pinnedIp) {
      return {
        blocked: true,
        reason: 'Host did not resolve',
        inputUrl: rawUrl,
        finalUrl: current,
        status: 0,
        reachable: false,
        redirectChain: chain,
        latency: Date.now() - start,
      };
    }

    let resp: { status: number; headers: http.IncomingHttpHeaders };
    try {
      resp = await pinnedRequest(current, pinnedIp, { method: 'HEAD', timeoutMs: safeTimeoutMs, userAgent });
      if (resp.status === 405 || resp.status === 501) {
        try {
          resp = await pinnedRequest(current, pinnedIp, { method: 'GET', timeoutMs: safeTimeoutMs, userAgent });
        } catch {
          // keep HEAD response
        }
      }
    } catch {
      return {
        inputUrl: rawUrl,
        finalUrl: current,
        status: 0,
        reachable: false,
        redirectChain: chain,
        latency: Date.now() - start,
      };
    }

    if (resp.status >= 300 && resp.status < 400) {
      const locHeader = resp.headers.location;
      const loc = Array.isArray(locHeader) ? locHeader[0] : locHeader;
      if (!loc) {
        return {
          inputUrl: rawUrl,
          finalUrl: current,
          status: resp.status,
          reachable: isReachableStatus(resp.status),
          redirectChain: chain,
          latency: Date.now() - start,
        };
      }
      try {
        current = new URL(loc, current).toString();
      } catch {
        return {
          inputUrl: rawUrl,
          finalUrl: current,
          status: resp.status,
          reachable: false,
          redirectChain: chain,
          latency: Date.now() - start,
        };
      }
      continue;
    }

    return {
      inputUrl: rawUrl,
      finalUrl: current,
      status: resp.status,
      reachable: isReachableStatus(resp.status),
      redirectChain: chain,
      latency: Date.now() - start,
    };
  }

  return {
    inputUrl: rawUrl,
    finalUrl: current,
    status: 0,
    reachable: false,
    redirectChain: chain,
    latency: Date.now() - start,
  };
}

export async function probeUptime(
  rawUrl: string,
  opts: { timeoutMs?: number; userAgent?: string } = {},
): Promise<{ httpStatus: 200 | 400; body: CheckResult | { error: string; message?: string } }> {
  let r = await safeHeadRequest(rawUrl, opts);

  if (r.blocked && r.unresolvable) {
    const alt = toggleWww(rawUrl);
    if (alt) {
      const r2 = await safeHeadRequest(alt, opts);
      // Accept the alternate only if it actually reached the host (resolved).
      if (!r2.blocked) r = r2;
      else if (!r2.unresolvable) r = r2;   // alt hit a real SSRF/scheme block → surface that
    }
  }

  if (r.blocked) {
    if (r.unresolvable) {
      // Genuinely dead domain → DOWN, not Error (AGENTS.md §1, known-gap #2 fixed).
      return { httpStatus: 200, body: { status: 'DOWN', statusCode: 0, latency: r.latency, message: r.reason } };
    }
    return { httpStatus: 400, body: { error: 'Blocked', message: r.reason } };
  }
  return { httpStatus: 200, body: toCheckResult(r) };
}
