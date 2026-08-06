/**
 * Block private / link-local / metadata targets for extension-initiated fetches.
 */
export function isBlockedFetchHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === 'metadata.google.internal') return true;

  // IPv4
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const parts = m.slice(1).map(Number);
    if (parts.some((n) => n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6 literals (basic)
  if (host.includes(':')) {
    if (host === '::1') return true;
    if (host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80')) return true;
  }

  return false;
}

export function assertPublicHttpUrl(value, label = 'URL') {
  let u;
  try {
    u = new URL(value);
  } catch {
    throw new Error(`Invalid ${label}.`);
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`${label} must be http(s).`);
  }
  if (isBlockedFetchHost(u.hostname)) {
    throw new Error(`${label} host is not allowed.`);
  }
  return u.href;
}
