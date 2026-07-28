import { describe, it, expect } from 'vitest';
import { DomainStatus } from '../../types';
import {
  filterHistoryByWindow,
  computeUptimePercent,
  formatDuration,
  formatMonitoringDuration,
  computeIncidents,
  computeUptimeSummary,
} from '../../utils/uptimeStats';

const makeRecord = (status: DomainStatus, offsetMs: number, base: Date) => ({
  timestamp: new Date(base.getTime() + offsetMs),
  status,
  statusCode: status === DomainStatus.Alive ? 200 : 0,
  latency: 100,
});

describe('uptimeStats', () => {
  const addedAt = new Date('2025-01-01T00:00:00Z');
  const now = new Date('2025-02-01T00:00:00Z');

  const history = [
    makeRecord(DomainStatus.Alive, 0, addedAt),
    makeRecord(DomainStatus.Alive, 60000, addedAt),
    makeRecord(DomainStatus.Down, 120000, addedAt),
    makeRecord(DomainStatus.Down, 180000, addedAt),
    makeRecord(DomainStatus.Alive, 240000, addedAt),
  ];

  it('filters history by since_added window', () => {
    const filtered = filterHistoryByWindow(history, addedAt, 'since_added', now);
    expect(filtered).toHaveLength(5);
  });

  it('computes uptime percent', () => {
    expect(computeUptimePercent(history)).toBe(60);
    expect(computeUptimePercent([])).toBeNull();
  });

  it('formats duration', () => {
    expect(formatDuration(90 * 60 * 1000)).toBe('1h 30m');
    expect(formatDuration(2 * 24 * 60 * 60 * 1000)).toBe('2d 0h');
  });

  it('formats monitoring duration', () => {
    const oneMonthAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    expect(formatMonitoringDuration(oneMonthAgo, now)).toMatch(/1mo/);
  });

  it('detects incidents', () => {
    const incidents = computeIncidents(history);
    expect(incidents).toHaveLength(1);
    expect(incidents[0]!.status).toBe(DomainStatus.Down);
  });

  it('computes uptime summary', () => {
    const summary = computeUptimeSummary(history, addedAt, 'since_added', now);
    expect(summary.uptimePercent).toBe(60);
    expect(summary.totalChecks).toBe(5);
    expect(summary.monitoringDuration).toBeTruthy();
  });
});
