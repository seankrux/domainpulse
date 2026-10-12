/**
 * Collision-resistant id generator for domains, groups, and notifications.
 *
 * Previously every call site used `Math.random().toString(36).substr(2, 9)`,
 * which (a) is only ~9 random characters and has produced real collisions in
 * bulk-embedded lists, silently merging domains, and (b) uses the deprecated
 * `substr`. `crypto.randomUUID()` is used when available (secure contexts,
 * modern browsers) with a fallback for older/insecure contexts.
 */
export function generateId(): string {
  const cryptoObj = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }
  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Last-resort fallback: longer than the old 9-char value to reduce collisions.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
