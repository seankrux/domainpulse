/**
 * Structured JSON logging for the DomainPulse API layer.
 *
 * Every log line is a single JSON object written to stdout (info/debug) or
 * stderr (warn/error) so log aggregators (Vercel, Datadog, etc.) can parse it
 * without a regex. Each line carries a consistent envelope:
 *
 *   { timestamp, level, service, env, version, requestId, operation, message, ... }
 *
 * Design constraints:
 * - Logging MUST NEVER throw. A logger that crashes the request is worse than
 *   no logger, so every write is wrapped and falls back to a minimal line.
 * - Secrets / PII are redacted before serialisation (see REDACT_KEY_PATTERN and
 *   the email masking) so tokens, passwords and cookies never reach the sink.
 * - No `console.*` (the repo's eslint `no-console` rule allows only warn/error);
 *   we write to the underlying streams directly, which is the correct sink for
 *   structured logs anyway.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  requestId?: string;
  operation?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  /** Return a new logger that merges additional bound context. */
  child(context: LogContext): Logger;
}

const SERVICE_NAME = 'domainpulse-api';

/** Keys whose values must never be logged, matched case-insensitively. */
const REDACT_KEY_PATTERN = /(authorization|password|passwd|secret|token|cookie|session|api[-_]?key|jwt|salt)/i;

/** Very small email detector for masking free-text PII in string values. */
const EMAIL_PATTERN = /([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;

const REDACTED = '[REDACTED]';
const MAX_DEPTH = 6;

function maskEmails(value: string): string {
  return value.replace(EMAIL_PATTERN, (_m, first: string, domain: string) => `${first}***${domain}`);
}

/**
 * Deep-clone `value` while redacting sensitive keys and masking emails.
 * Guards against circular references and pathological depth so a caller can
 * never make the logger loop or blow the stack.
 */
export function redact(value: unknown, seen: WeakSet<object> = new WeakSet(), depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return maskEmails(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[Function]';

  if (depth >= MAX_DEPTH) return '[Truncated]';

  if (value instanceof Error) {
    return { name: value.name, message: maskEmails(value.message) };
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return value.map((item) => redact(item, seen, depth + 1));
  }

  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]';
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACT_KEY_PATTERN.test(key) ? REDACTED : redact(val, seen, depth + 1);
    }
    return out;
  }

  return String(value);
}

function resolveEnv(): string {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
}

function resolveVersion(): string {
  return (
    process.env.APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.npm_package_version ||
    'dev'
  );
}

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): LogLevel {
  const configured = (process.env.LOG_LEVEL || '').toLowerCase();
  if (configured === 'debug' || configured === 'info' || configured === 'warn' || configured === 'error') {
    return configured;
  }
  // Default: quieter in production, chatty in dev.
  return resolveEnv() === 'production' ? 'info' : 'debug';
}

function write(level: LogLevel, line: string): void {
  try {
    const stream = level === 'warn' || level === 'error' ? process.stderr : process.stdout;
    stream.write(line + '\n');
  } catch {
    // Never let logging failures propagate to the request path.
  }
}

function emit(level: LogLevel, context: LogContext, message: string, meta?: Record<string, unknown>): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[minLevel()]) return;

  let line: string;
  try {
    const envelope: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      env: resolveEnv(),
      version: resolveVersion(),
      ...(redact(context) as Record<string, unknown>),
      message,
    };
    if (meta && Object.keys(meta).length > 0) {
      Object.assign(envelope, redact(meta) as Record<string, unknown>);
    }
    line = JSON.stringify(envelope);
  } catch {
    // Serialisation fell over (should be impossible after redact()); emit a
    // minimal, guaranteed-serialisable line instead of throwing.
    line = JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      service: SERVICE_NAME,
      message,
      logError: 'serialization_failed',
    });
  }
  write(level, line);
}

/**
 * Create a logger bound to a base context (e.g. { operation, requestId }).
 * Child loggers merge additional context on top.
 */
export function createLogger(context: LogContext = {}): Logger {
  const base = context;
  return {
    debug: (message, meta) => emit('debug', base, message, meta),
    info: (message, meta) => emit('info', base, message, meta),
    warn: (message, meta) => emit('warn', base, message, meta),
    error: (message, meta) => emit('error', base, message, meta),
    child: (extra) => createLogger({ ...base, ...extra }),
  };
}
