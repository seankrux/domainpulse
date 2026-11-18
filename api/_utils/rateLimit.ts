/**
 * Shared rate limiting utility for API endpoints.
 * 
 * Production/development: Uses the shared per-instance request budget
 * State expires at the configured window and resets on instance cold start.
 * 
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const defaultConfig: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60000 // 1 minute
};

// Shared instance budget (resets on cold start)
const requestCounts = new Map<string, RateLimitRecord>();

/**
 * Check if request is within rate limit.
 *
 * Uses in-memory storage shared by all endpoints in an instance (resets on cold start).
 *
 * @param ip - Client IP address
 * @param config - Rate limit configuration
 * @returns true if request is allowed, false if rate limited
 */
export const checkRateLimit = async (ip: string, config: RateLimitConfig = defaultConfig): Promise<boolean> => {
  const now = Date.now();

  // Fallback to in-memory (development or no KV)
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    // Opportunistically evict expired keys so a flood of distinct (or spoofed
    // X-Forwarded-For) IPs can't grow this map without bound for the lifetime
    // of the warm instance.
    if (requestCounts.size > 1000) {
      for (const [key, rec] of requestCounts) {
        if (now > rec.resetTime) requestCounts.delete(key);
      }
    }
    requestCounts.set(ip, { count: 1, resetTime: now + config.windowMs });
    return true;
  }

  if (record.count >= config.maxRequests) {
    return false;
  }

  record.count++;
  requestCounts.set(ip, record);
  return true;
};

/**
 * Get rate limit headers for response.
 * Reflects the current shared instance budget.
 * @param ip - Client IP address
 * @param config - Rate limit configuration
 * @returns Headers to include in response
 */
export const getRateLimitHeaders = async (ip: string, config: RateLimitConfig = defaultConfig): Promise<Record<string, string>> => {
  const now = Date.now();

  // In-memory fallback
  const record = requestCounts.get(ip);
  const remaining = record && now <= record.resetTime
    ? Math.max(0, config.maxRequests - record.count)
    : config.maxRequests;

  const resetTime = record?.resetTime || now + config.windowMs;

  return {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(resetTime)
  };
};

/**
 * Clear rate limit data for an IP (useful for testing).
 */
export const clearRateLimit = (ip: string): void => {
  requestCounts.delete(ip);
};

/**
 * Clear all rate limit data (useful for testing).
 */
export const clearAllRateLimits = (): void => {
  requestCounts.clear();
};
