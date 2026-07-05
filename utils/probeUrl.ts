/**
 * Build the probe URL for a stored (scheme-less) domain. The scheme test must
 * anchor on `http://`/`https://`, not `startsWith('http')` — hosts that merely
 * BEGIN with "http" (httpstat.us, httpbin.org) otherwise skip the prefix and
 * fail as "Invalid URL". Mirrored server-side by `toProbeUrl` in
 * `api/_utils/ssrfGuard.ts` (browser code can't import that Node-only module).
 *
 * Lives in a dependency-free module: both `domainService` and
 * `techDetectionService` need it, and `domainService` already imports
 * `techDetectionService`, so hosting it in either would be circular.
 */
export const toProbeUrl = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;
