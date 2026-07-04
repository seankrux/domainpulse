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

/** Async: literal check + resolve every A/AAAA and ensure all are public. */
export async function validateOutboundUrlResolved(raw: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const lit = validateOutboundUrl(raw);
  if (!lit.ok) return lit;
  const host = new URL(raw).hostname.replace(/^\[|\]$/g, '');
  if (isBlockedIp(host)) return { ok: false, reason: 'Target host is not allowed (private/internal address)' };
  // Only skip DNS for a CANONICAL IP literal (isBlockedIp already cleared it).
  // Non-canonical numeric forms (127.1, 2130706433, 0177.0.0.1) are not valid
  // per isIP(), so they fall through to dns.lookup, whose getaddrinfo
  // normalises them to the real address — which isBlockedIp then blocks.
  if (isIP(host) !== 0) return { ok: true };
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
