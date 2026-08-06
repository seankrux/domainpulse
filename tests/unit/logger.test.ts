import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redact, createLogger } from '../../api/_utils/logger';

/**
 * The logger is an observability primitive: it must never throw, must redact
 * secrets/PII, and must emit one parseable JSON object per line.
 */
describe('redact()', () => {
  it('redacts sensitive keys case-insensitively at any depth', () => {
    const input = {
      Authorization: 'Bearer abc.def.ghi',
      password: 'hunter2',
      apiKey: 'k-123',
      api_key: 'k-456',
      nested: { token: 't-789', jwt: 'j-000', keep: 'visible' },
      list: [{ secret: 's' }, { ok: 1 }],
    };
    const out = redact(input) as Record<string, unknown>;
    expect(out.Authorization).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect(out.apiKey).toBe('[REDACTED]');
    expect(out.api_key).toBe('[REDACTED]');
    const nested = out.nested as Record<string, unknown>;
    expect(nested.token).toBe('[REDACTED]');
    expect(nested.jwt).toBe('[REDACTED]');
    expect(nested.keep).toBe('visible');
    const list = out.list as Record<string, unknown>[];
    expect(list[0]!.secret).toBe('[REDACTED]');
    expect(list[1]!.ok).toBe(1);
  });

  it('masks email addresses in string values (PII)', () => {
    expect(redact('contact jane.doe@example.com now')).toBe('contact j***@example.com now');
    const out = redact({ note: 'user bob@corp.io' }) as Record<string, unknown>;
    expect(out.note).toBe('user b***@corp.io');
  });

  it('handles circular references without looping (negative path)', () => {
    const a: Record<string, unknown> = { name: 'a' };
    a.self = a;
    const out = redact(a) as Record<string, unknown>;
    expect(out.name).toBe('a');
    expect(out.self).toBe('[Circular]');
  });

  it('truncates pathologically deep structures instead of overflowing', () => {
    let deep: Record<string, unknown> = { v: 'leaf' };
    for (let i = 0; i < 20; i++) deep = { child: deep };
    // Should not throw and should terminate.
    expect(() => JSON.stringify(redact(deep))).not.toThrow();
    expect(JSON.stringify(redact(deep))).toContain('[Truncated]');
  });

  it('serialises Error objects to name/message only', () => {
    const out = redact(new Error('boom with bob@x.com')) as Record<string, unknown>;
    expect(out.name).toBe('Error');
    expect(out.message).toBe('boom with b***@x.com');
  });
});

describe('createLogger()', () => {
  let stdout: ReturnType<typeof vi.spyOn>;
  let stderr: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv('LOG_LEVEL', 'debug');
    stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const lastLine = (spy: ReturnType<typeof vi.spyOn>) =>
    JSON.parse((spy.mock.calls.at(-1)![0] as string).trim());

  it('emits a JSON envelope with the required fields and bound context', () => {
    const log = createLogger({ operation: 'check', requestId: 'req-1' });
    log.info('request.start', { method: 'GET' });
    const line = lastLine(stdout);
    expect(line.level).toBe('info');
    expect(line.service).toBe('domainpulse-api');
    expect(line.operation).toBe('check');
    expect(line.requestId).toBe('req-1');
    expect(line.message).toBe('request.start');
    expect(line.method).toBe('GET');
    expect(typeof line.timestamp).toBe('string');
    expect(line.version).toBeDefined();
  });

  it('writes warn/error to stderr and redacts secrets in meta', () => {
    const log = createLogger({ operation: 'login', requestId: 'req-2' });
    log.error('request.error', { authorization: 'Bearer secret', statusCode: 500 });
    const line = lastLine(stderr);
    expect(line.level).toBe('error');
    expect(line.authorization).toBe('[REDACTED]');
    expect(line.statusCode).toBe(500);
  });

  it('respects LOG_LEVEL filtering (debug suppressed when level=warn)', () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const log = createLogger();
    log.debug('should be dropped');
    log.info('should be dropped too');
    expect(stdout).not.toHaveBeenCalled();
    log.warn('kept');
    expect(stderr).toHaveBeenCalledTimes(1);
  });

  it('child() merges additional context', () => {
    const base = createLogger({ operation: 'dns', requestId: 'req-3' });
    base.child({ domain: 'example.com' }).info('lookup');
    const line = lastLine(stdout);
    expect(line.operation).toBe('dns');
    expect(line.requestId).toBe('req-3');
    expect(line.domain).toBe('example.com');
  });

  it('never throws even if writing to the stream fails (negative path)', () => {
    stdout.mockImplementation(() => {
      throw new Error('EPIPE');
    });
    const log = createLogger();
    expect(() => log.info('still safe')).not.toThrow();
  });
});
