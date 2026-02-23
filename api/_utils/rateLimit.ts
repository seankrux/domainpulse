/**
 * Shared rate limiting utility for API endpoints.
 * Uses in-memory storage (for Vercel serverless, consider Redis for production).
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

// In-memory store (resets on cold start)
const requestCounts = new Map<string, RateLimitRecord>();

/**
 * Check if request is within rate limit.
 * @param ip - Client IP address
 * @param config - Rate limit configuration
 * @returns true if request is allowed, false if rate limited
 */
export const checkRateLimit = (ip: string, config: RateLimitConfig = defaultConfig): boolean => {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
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
 * @param ip - Client IP address
 * @param config - Rate limit configuration
 * @returns Headers to include in response
 */
export const getRateLimitHeaders = (ip: string, config: RateLimitConfig = defaultConfig): Record<string, string> => {
  const record = requestCounts.get(ip);
  const now = Date.now();
  
  const remaining = record && now <= record.resetTime 
    ? Math.max(0, config.maxRequests - record.count)
    : config.maxRequests;
  
  const resetTime = record?.resetTime || now + config.windowMs;
  const resetSeconds = Math.ceil((resetTime - now) / 1000);

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
