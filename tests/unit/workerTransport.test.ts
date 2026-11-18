import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeUptime } from '../../api/_utils/ssrfGuard';
import { workerRequest } from '../../api/_utils/workerTransport';

const { lookup, outbound } = vi.hoisted(() => ({ lookup: vi.fn(), outbound: vi.fn() }));
vi.mock('node:dns', () => ({ default: { promises: { lookup } }, promises: { lookup } }));

beforeEach(() => {
  vi.stubEnv('DOMAINPULSE_WORKER', 'true');
  vi.stubGlobal('fetch', outbound);
  lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  outbound.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Workers liveness and SSRF transport', () => {
  it.each([401, 403, 404, 429])('a reachable HTTP %i remains ALIVE', async (status) => {
    outbound.mockResolvedValue(new Response(null, { status }));
    const result = await probeUptime('https://example.test');
    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({ status: 'ALIVE', statusCode: status });
    expect(outbound.mock.calls[0]?.[1]).toMatchObject({ method: 'HEAD', redirect: 'manual' });
  });

  it.each([405, 501])('retries HEAD %i with GET', async (status) => {
    outbound.mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(new Response(null, { status: 200 }));
    expect((await probeUptime('https://example.test')).body).toMatchObject({ status: 'ALIVE' });
    expect(outbound.mock.calls.map((call) => call[1].method)).toEqual(['HEAD', 'GET']);
  });

  it('never fetches a literal private destination', async () => {
    expect((await probeUptime('http://127.0.0.1')).httpStatus).toBe(400);
    expect(outbound).not.toHaveBeenCalled();
  });

  it('rejects a hostname with any private DNS answer', async () => {
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]);
    expect((await probeUptime('https://example.test')).httpStatus).toBe(400);
    expect(outbound).not.toHaveBeenCalled();
  });

  it('revalidates redirect targets before any second fetch', async () => {
    outbound.mockResolvedValue(new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest/meta-data' } }));
    expect((await probeUptime('https://example.test')).httpStatus).toBe(400);
    expect(outbound).toHaveBeenCalledTimes(1);
  });

  it('keeps a genuinely unresolvable target DOWN instead of blocked', async () => {
    lookup.mockRejectedValue(Object.assign(new Error('Not found'), { code: 'ENOTFOUND' }));
    const result = await probeUptime('https://example.invalid');
    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({ status: 'DOWN', statusCode: 0 });
    expect(outbound).not.toHaveBeenCalled();
  });

  it('bounds fetched HTML before tech parsing', async () => {
    outbound.mockResolvedValue(new Response('0123456789abcdef', { status: 200 }));
    const result = await workerRequest('https://example.test', { method: 'GET', timeoutMs: 10000, userAgent: 'DomainPulse test', maxBodyBytes: 8 });
    expect(result.body).toBe('01234567');
  });
});
