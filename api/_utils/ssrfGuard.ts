/**
 * SSRF guard for endpoints that fetch/connect to a user-supplied target.
 *
 * Blocks loopback, private/reserved ranges, link-local + cloud-metadata
 * (169.254.0.0/16), and non-http(s) schemes. This stops the obvious attack
 * (e.g. ?url=http://localhost or http://169.254.169.254/) where the server
 * would otherwise report whether an internal service is alive.
 *
 * Pure + dependency-free so the Vercel functions, the dev proxy, and unit
 * tests can all share it.
 */

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata.google.internal', 'metadata']);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true; // malformed → block
  if (a === 0 || a === 10 || a === 127) return true;        // this-host, private, loopback
  if (a === 169 && b === 254) return true;                  // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;         // private
  if (a === 192 && b === 168) return true;                  // private
  if (a === 100 && b >= 64 && b <= 127) return true;        // CGNAT
  if (a >= 224) return true;                                // multicast / reserved
  return false;
}

/** True when a hostname must not be reached from a server-side fetch. */
export function isBlockedHost(hostname: string | undefined): boolean {
  if (!hostname) return true;
  let h = hostname.toLowerCase().replace(/\.$/, '');
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1); // strip IPv6 brackets
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true;
  if (h === '0.0.0.0' || h === '::' || h === '::1') return true;
  // IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true;
  if (isPrivateIPv4(h)) return true;
  return false;
}

/** Validate a full URL is safe to fetch. Returns a reason string when blocked. */
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
