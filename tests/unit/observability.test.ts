import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withObservability } from '../../api/_utils/observability';
import { validationError } from '../../api/_utils/errors';

/**
 * The wrapper must be behavior-preserving on the happy path (handler owns the
 * response) and only take over on an uncaught throw, mapping it through the
 * error taxonomy. It must also stamp a correlation id.
 */
function makeReq(headers: Record<string, string> = {}, method = 'GET', url = '/api/check'): VercelRequest {
  return { headers, method, url, socket: {} } as unknown as VercelRequest;
}

function makeRes() {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    headersSent: false,
    jsonBody: undefined as unknown,
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    getHeader(key: string) {
      return headers[key];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.jsonBody = body;
      this.headersSent = true;
      return this;
    },
  };
  return res as unknown as VercelResponse & { jsonBody: unknown; getHeader(k: string): string };
}

describe('withObservability()', () => {
  beforeEach(() => {
    vi.stubEnv('LOG_LEVEL', 'error'); // keep test output quiet
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('leaves the handler-owned response untouched and stamps a request id', async () => {
    const handler = vi.fn((_req: VercelRequest, res: VercelResponse) => {
      res.status(200).json({ ok: true });
    });
    const req = makeReq();
    const res = makeRes();
    await withObservability('check', handler)(req, res);

    expect(handler).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.jsonBody).toEqual({ ok: true });
    expect(res.getHeader('x-request-id')).toBeTruthy();
  });

  it('reuses an inbound x-request-id for correlation', async () => {
    const handler = (_req: VercelRequest, res: VercelResponse) => res.status(200).json({});
    const res = makeRes();
    await withObservability('check', handler)(makeReq({ 'x-request-id': 'trace-123' }), res);
    expect(res.getHeader('x-request-id')).toBe('trace-123');
  });

  it('funnels an uncaught throw through the error taxonomy', async () => {
    const handler = () => {
      throw validationError('Domain is required');
    };
    const res = makeRes();
    await withObservability('check', handler)(makeReq(), res);
    expect(res.statusCode).toBe(400);
    expect(res.jsonBody).toMatchObject({ error: 'Domain is required', code: 'validation' });
    expect((res.jsonBody as { requestId: string }).requestId).toBeTruthy();
  });

  it('does not leak internal detail on an unexpected throw', async () => {
    const handler = () => {
      throw new Error('secret db dsn postgres://user:pw@host');
    };
    const res = makeRes();
    await withObservability('ssl', handler)(makeReq(), res);
    expect(res.statusCode).toBe(500);
    expect(res.jsonBody).toMatchObject({ error: 'Internal server error.', code: 'internal' });
    expect(JSON.stringify(res.jsonBody)).not.toContain('postgres://');
  });

  it('does not attempt to respond if headers were already sent (negative path)', async () => {
    const handler = (_req: VercelRequest, res: VercelResponse) => {
      res.status(200).json({ partial: true });
      throw new Error('boom after send');
    };
    const res = makeRes();
    await withObservability('dns', handler)(makeReq(), res);
    // Response stays as the handler left it; wrapper does not overwrite.
    expect(res.jsonBody).toEqual({ partial: true });
    expect(res.statusCode).toBe(200);
  });
});
