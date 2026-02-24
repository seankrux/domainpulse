/**
 * Shared rate limiting utility for API endpoints.
 * 
 * Production: Uses Vercel KV for distributed rate limiting (requires @vercel/kv)
 * Development: Falls back to in-memory storage
 * 
 * @see https://vercel.com/docs/storage/vercel-kv
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

// Try to import Vercel KV for production use
let kv: typeof import('@vercel/kv') | undefined;
let hasKV = false;

try {
  // Dynamic import to avoid bundling @vercel/kv if not used
  kv = require('@vercel/kv');
  hasKV = process.env.KV_URL !== undefined;
} catch {
  // @vercel/kv not installed or KV_URL not configured
  hasKV = false;
}

// In-memory store (development only, resets on cold start)
const requestCounts = new Map<string, RateLimitRecord>();

/**
 * Check if request is within rate limit.
 * 
 * In production with KV_URL configured, uses Vercel KV for distributed rate limiting.
 * In development or without KV, uses in-memory storage (resets on cold start).
 * 
 * @param ip - Client IP address
 * @param config - Rate limit configuration
 * @returns true if request is allowed, false if rate limited
 */
export const checkRateLimit = async (ip: string, config: RateLimitConfig = defaultConfig): Promise<boolean> => {
  const now = Date.now();
  
  // Use Vercel KV in production if available
  if (hasKV && kv) {
    const key = `ratelimit:${ip}`;
    const current = await kv.incr(key);
    
    if (current === 1) {
      // First request, set expiry
      await kv.expire(key, Math.ceil(config.windowMs / 1000));
      return true;
    }
    
    return current <= config.maxRequests;
  }
  
  // Fallback to in-memory (development or no KV)
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
 * Note: In production with KV, this is an approximation since we don't fetch current count.
 * @param ip - Client IP address
 * @param config - Rate limit configuration
 * @returns Headers to include in response
 */
export const getRateLimitHeaders = async (ip: string, config: RateLimitConfig = defaultConfig): Promise<Record<string, string>> => {
  const now = Date.now();
  
  // With Vercel KV, provide approximate headers
  if (hasKV && kv) {
    const key = `ratelimit:${ip}`;
    const ttl = await kv.ttl(key);
    const remaining = ttl > 0 ? config.maxRequests : config.maxRequests;
    
    return {
      'X-RateLimit-Limit': String(config.maxRequests),
      'X-RateLimit-Remaining': String(Math.max(0, remaining)),
      'X-RateLimit-Reset': String(ttl > 0 ? now + (ttl * 1000) : now + config.windowMs)
    };
  }
  
  // In-memory fallback
  const record = requestCounts.get(ip);
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
