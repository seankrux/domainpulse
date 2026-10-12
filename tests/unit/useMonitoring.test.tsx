import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMonitoring } from '../../hooks/useMonitoring';
import { Domain, DomainStatus, SSLStatus } from '../../types';

// The hook calls checkDomainWithSSL / checkGmb directly (worker path is only
// used when a Worker global exists). Mock the services so tests stay offline.
vi.mock('../../services/domainService', () => ({
  checkDomainWithSSL: vi.fn(),
}));
vi.mock('../../services/gmbService', () => ({
  checkGmb: vi.fn(),
}));

import { checkDomainWithSSL } from '../../services/domainService';

const mockedCheck = vi.mocked(checkDomainWithSSL);

/** A Worker stub that records posted messages. */
class FakeWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  onmessageerror: ((e: MessageEvent) => void) | null = null;
  posted: unknown[] = [];
  postMessage(msg: unknown) { this.posted.push(msg); }
  terminate() {}
}

const mkDomain = (over: Partial<Domain> & { id: string; url: string }): Domain => ({
  status: DomainStatus.Unknown,
  addedAt: new Date(0),
  history: [],
  tags: [],
  ...over,
});

const ALIVE_RESULT = {
  status: DomainStatus.Alive,
  statusCode: 200,
  latency: 5,
  ssl: { status: SSLStatus.Valid },
  enrichmentTimedOut: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  // jsdom has no Worker; the hook constructs one on mount. Provide a stub so
  // mount succeeds. checkSingleDomain runs on the main thread regardless.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Worker = FakeWorker;
});

function setup(domains: Domain[]) {
  let current = domains;
  const setDomains = vi.fn((updater: Domain[] | ((prev: Domain[]) => Domain[])) => {
    current = typeof updater === 'function' ? updater(current) : updater;
    return current;
  });
  const showSuccess = vi.fn();
  const utils = renderHook(() =>
    useMonitoring({ domains, setDomains, maxHistoryRecords: 5, showSuccess }),
  );
  return { ...utils, setDomains, showSuccess, getDomains: () => current };
}

describe('useMonitoring', () => {
  it('does not strand isCheckingAll=true when there is nothing to check', async () => {
    const domains = [mkDomain({ id: '1', url: 'a.com', status: DomainStatus.Checking })];
    const { result } = setup(domains);

    await act(async () => {
      await result.current.checkAllDomains();
    });

    // Every domain is already Checking → filter yields [] → must bail before
    // raising the flag (otherwise the flag never clears and Check All sticks off).
    expect(result.current.isCheckingAll).toBe(false);
    expect(mockedCheck).not.toHaveBeenCalled();
  });

  it('passes the sessionStorage token to a single-domain check (AGENTS.md §5)', async () => {
    sessionStorage.setItem(
      'domainpulse_auth_session',
      JSON.stringify({ token: 'sess-tok', expiresAt: Date.now() + 60000 }),
    );
    mockedCheck.mockResolvedValue(ALIVE_RESULT as never);

    const domains = [mkDomain({ id: '1', url: 'a.com' })];
    const { result } = setup(domains);

    await act(async () => {
      await result.current.checkSingleDomain('1', 'a.com');
    });

    expect(mockedCheck).toHaveBeenCalledTimes(1);
    const call = mockedCheck.mock.calls[0]!;
    expect(call[1]?.authToken).toBe('sess-tok');
  });

  it('applies a successful result and records history', async () => {
    mockedCheck.mockResolvedValue(ALIVE_RESULT as never);
    const domains = [mkDomain({ id: '1', url: 'a.com' })];
    const { result, getDomains } = setup(domains);

    await act(async () => {
      await result.current.checkSingleDomain('1', 'a.com');
    });

    const updated = getDomains().find(d => d.id === '1');
    expect(updated?.status).toBe(DomainStatus.Alive);
    expect(updated?.statusCode).toBe(200);
    expect(updated?.history).toHaveLength(1);
    expect(updated?.history[0]?.status).toBe(DomainStatus.Alive);
  });

  it('marks Error and dispatches auth-invalid on an Unauthorized failure', async () => {
    mockedCheck.mockRejectedValue(new Error('Unauthorized'));
    const dispatchSpy = vi.fn();
    window.addEventListener('domainpulse:auth-invalid', dispatchSpy);

    const domains = [mkDomain({ id: '1', url: 'a.com' })];
    const { result, getDomains } = setup(domains);

    await act(async () => {
      await result.current.checkSingleDomain('1', 'a.com');
    });

    expect(getDomains().find(d => d.id === '1')?.status).toBe(DomainStatus.Error);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    window.removeEventListener('domainpulse:auth-invalid', dispatchSpy);
  });

  it('does not overwrite prior enrichment when enrichment times out', async () => {
    mockedCheck.mockResolvedValue({
      status: DomainStatus.Alive,
      statusCode: 200,
      latency: 5,
      enrichmentTimedOut: true,
    } as never);
    const domains = [
      mkDomain({ id: '1', url: 'a.com', ssl: { status: SSLStatus.Valid } as Domain['ssl'] }),
    ];
    const { result, getDomains } = setup(domains);

    await act(async () => {
      await result.current.checkSingleDomain('1', 'a.com');
    });

    // Liveness updated, but the prior SSL snapshot must survive the timeout.
    const updated = getDomains().find(d => d.id === '1');
    expect(updated?.status).toBe(DomainStatus.Alive);
    expect(updated?.ssl?.status).toBe(SSLStatus.Valid);
  });

  it('trims history to maxHistoryRecords', async () => {
    mockedCheck.mockResolvedValue(ALIVE_RESULT as never);
    const prior = Array.from({ length: 5 }, () => ({
      timestamp: new Date(0),
      status: DomainStatus.Unknown,
      statusCode: 0,
      latency: 0,
    }));
    const domains = [mkDomain({ id: '1', url: 'a.com', history: prior })];
    const { result, getDomains } = setup(domains);

    await act(async () => {
      await result.current.checkSingleDomain('1', 'a.com');
    });

    expect(getDomains().find(d => d.id === '1')?.history).toHaveLength(5);
  });
});
