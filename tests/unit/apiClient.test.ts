import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchWithRetry,
  parseRetryAfter,
  RateLimitError,
  RETRY_BASE_DELAY_MS,
} from '../../services/apiClient';

const jsonResponse = (status: number, headers: Record<string, string> = {}): Response =>
  new Response(status === 204 ? null : JSON.stringify({ ok: status < 400 }), {
    status,
    headers,
  });

describe('parseRetryAfter', () => {
  it('parses delta-seconds', () => {
    expect(parseRetryAfter('2')).toBe(2000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parses an HTTP-date into a non-negative delta', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfter(future);
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThan(0);
    expect(ms!).toBeLessThanOrEqual(6000);
  });

  it('returns null for missing/empty/unparseable values', () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter('')).toBeNull();
    expect(parseRetryAfter('not-a-date')).toBeNull();
  });
});

describe('fetchWithRetry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns a non-429 response without retrying', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200));
    const res = await fetchWithRetry('https://x/api/ssl');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('passes non-429 errors (e.g. 401) straight through for caller handling', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401));
    const res = await fetchWithRetry('https://x/api/ssl');
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 and succeeds, honouring Retry-After', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(429, { 'Retry-After': '0' }))
      .mockResolvedValueOnce(jsonResponse(200));

    const res = await fetchWithRetry('https://x/api/check', {}, { baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws RateLimitError after exhausting attempts on a persistent 429', async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, { 'Retry-After': '0' }));

    await expect(
      fetchWithRetry('https://x/api/check', {}, { maxAttempts: 3, baseDelayMs: 1 })
    ).rejects.toBeInstanceOf(RateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry network errors by default (fail fast for callers)', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));
    await expect(fetchWithRetry('https://x/api/check')).rejects.toThrow('ECONNRESET');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries transient network errors when explicitly enabled', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(jsonResponse(200));

    const res = await fetchWithRetry('https://x/api/check', {}, { baseDelayMs: 1, retryNetworkErrors: true });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never sleeps past the supplied deadline', async () => {
    fetchMock.mockResolvedValue(jsonResponse(429, { 'Retry-After': '10' }));
    const start = Date.now();
    await expect(
      fetchWithRetry('https://x/api/check', {}, {
        maxAttempts: 5,
        deadline: Date.now() + 30, // 30ms budget, header asks for 10s
      })
    ).rejects.toBeInstanceOf(RateLimitError);
    // With the deadline honoured the whole call stays near the budget, not 10s.
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it('exposes a sane default base delay', () => {
    expect(RETRY_BASE_DELAY_MS).toBeGreaterThan(0);
  });
});
