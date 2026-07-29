/**
 * Neon Postgres client for DomainPulse persistence.
 * Uses DATABASE_URL. When unset, persistence APIs report unavailable
 * and the client falls back to localStorage.
 */
import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let sql: NeonQueryFunction<false, false> | null = null;

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getSql(): NeonQueryFunction<false, false> {
  if (!isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!sql) {
    sql = neon(process.env.DATABASE_URL!);
  }
  return sql;
}
