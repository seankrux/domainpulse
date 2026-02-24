/**
 * Centralized configuration for DomainPulse.
 * All timeout values, limits, and constants are defined here.
 */

export const config = {
  // Timeouts (milliseconds)
  timeouts: {
    domainCheck: 15000,      // Default timeout for domain checks
    sslCheck: 10000,         // Timeout for SSL certificate checks
    whoisCheck: 10000,       // Timeout for WHOIS expiry checks
    dnsCheck: 8000,          // Timeout for DNS lookups
    apiRequest: 10000,       // General API request timeout
  },

  // Rate limiting
  rateLimit: {
    maxRequests: 100,        // Maximum requests per window
    windowMs: 60000,         // Time window in milliseconds (1 minute)
  },

  // Monitoring
  monitoring: {
    maxHistoryRecords: 100,  // Maximum history records per domain
    defaultRefreshInterval: 300000,  // Default auto-refresh interval (5 minutes)
    minRefreshInterval: 60000,       // Minimum refresh interval (1 minute)
    maxRefreshInterval: 3600000,     // Maximum refresh interval (1 hour)
    maxPreviousStatuses: 100,        // Max domains to track for status changes
  },

  // Authentication
  auth: {
    sessionTTL: 13 * 60 * 60 * 1000,  // Session TTL (13 hours)
    passwordMinLength: 8,             // Minimum password length
  },

  // SSL
  ssl: {
    expiringThresholdDays: 30,  // Warn when certificate expires within X days
  },

  // Domain validation
  domain: {
    maxDomains: 1000,         // Maximum domains that can be tracked
    maxTagsPerDomain: 10,     // Maximum tags per domain
    maxTagLength: 50,         // Maximum length of a tag
  },

  // Proxy
  proxy: {
    defaultUrl: 'http://localhost:3001',
  },

  // UI
  ui: {
    animationDuration: 300,   // Default animation duration (ms)
    notificationDuration: 5000,  // Notification auto-dismiss (ms)
  },
} as const;

/**
 * Get a configuration value by path.
 * @example getConfig('timeouts.domainCheck') // 15000
 */
export function getConfig<T extends keyof typeof config | `${keyof typeof config}.${string}`>(
  path: T
): T extends `${string}.${string}` ? any : typeof config[T] {
  const parts = path.split('.');
  let value: any = config;
  
  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part as keyof typeof value];
    } else {
      throw new Error(`Invalid config path: ${path}`);
    }
  }
  
  return value;
}

export default config;
