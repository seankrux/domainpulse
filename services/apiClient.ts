import { logger } from '../utils/logger';

/**
 * Rate-limit-aware fetch wrapper shared by every client service.
 *
 * The API applies a per-IP request budget (see `lib/config.ts` + AGENTS.md).
 * A single domain check fans out to `/api/check` plus seven enrichment calls,
 * so a bulk run can legitimately exceed the budget. Without handling, a `429`
 * was silently treated as a failed sub-check: enrichment degraded to defaults,
 * and a `429` on the liveness probe itself surfaced an alive domain as `Error`.
 *
 * `fetchWithRetry` honours `Retry-After`, backs off exponentially (with jitter)
 * and retries, so a transient `429` no longer masquerades as "domain down".
 */

export const RETRY_MAX_ATTEMPTS = 4;
export const RETRY_BASE_DELAY_MS = 1000;
export const RETRY_MAX_DELAY_MS = 30000;

/** Thrown after exhausting retries against a `429`. */
export class RateLimitError extends Error {
  constructor(message = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

/**
 * Parse a `Retry-After` header (delta-seconds or HTTP-date) into milliseconds.
 * Returns null when the header is absent or unparseable.
 */
export function parseRetryAfter(header: string | null | undefined): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed === '') return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(trimmed);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
}

/** Exponential backoff with jitter, capped at `maxMs`. */
function backoffDelay(attempt: number, baseMs: number, maxMs: number): number {
  const exp = Math.min(maxMs, baseMs * 2 ** attempt);
  return Math.min(maxMs, exp + Math.random() * exp * 0.25);
}

/** Sleep, but never past an absolute `deadline` (ms epoch). */
async function sleepWithin(ms: number, deadline?: number): Promise<void> {
  let wait = ms;
  if (deadline !== undefined) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return;
    wait = Math.min(wait, remaining);
  }
  await new Promise<void>((resolve) => setTimeout(resolve, wait));
}

export interface RetryOptions {
  /** Total attempts including the first. Defaults to `RETRY_MAX_ATTEMPTS`. */
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Absolute ms-epoch after which no further retry is attempted. */
  deadline?: number;
  /** Label used in logs (usually the URL). */
  label?: string;
  /** Also retry on network-level fetch failures. Defaults to false — the
   *  valuable case is 429; retrying a dead endpoint only delays the caller's
   *  graceful degradation (enrichment has a soft timeout). Opt in explicitly. */
  retryNetworkErrors?: boolean;
}

/**
 * `fetch` a URL, retrying on `429`. Non-`429` HTTP responses are returned as-is
 * so callers keep their existing status handling (e.g. `401` → Unauthorized).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {}
): Promise<Response> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? RETRY_MAX_ATTEMPTS);
  const baseDelayMs = opts.baseDelayMs ?? RETRY_BASE_DELAY_MS;
  const maxDelayMs = opts.maxDelayMs ?? RETRY_MAX_DELAY_MS;
  const label = opts.label ?? url;
  const retryNetworkErrors = opts.retryNetworkErrors ?? false;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (!retryNetworkErrors || attempt === maxAttempts - 1) throw error;
      await sleepWithin(backoffDelay(attempt, baseDelayMs, maxDelayMs), opts.deadline);
      continue;
    }

    if (response.status !== 429) return response;

    if (attempt === maxAttempts - 1) {
      throw new RateLimitError(`Rate limited after ${maxAttempts} attempts: ${label}`);
    }
    const retryAfter = parseRetryAfter(response.headers.get('Retry-After'));
    const delay = retryAfter ?? backoffDelay(attempt, baseDelayMs, maxDelayMs);
    logger.warn(
      `429 rate limited — retrying in ${Math.round(delay)}ms ` +
        `(attempt ${attempt + 1}/${maxAttempts}): ${label}`
    );
    await sleepWithin(delay, opts.deadline);
  }

  throw lastError instanceof Error ? lastError : new RateLimitError(`Rate limited: ${label}`);
}
