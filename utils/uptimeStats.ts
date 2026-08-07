import { DomainStatus, StatusRecord } from '../types';

export type TimeWindow = '24h' | '7d' | '30d' | 'since_added' | 'all';

const WINDOW_MS: Record<Exclude<TimeWindow, 'since_added' | 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export function filterHistoryByWindow(
  history: StatusRecord[],
  addedAt: Date,
  window: TimeWindow,
  now: Date = new Date(),
): StatusRecord[] {
  if (history.length === 0) return [];

  if (window === 'all') return history;

  const cutoff =
    window === 'since_added'
      ? addedAt.getTime()
      : now.getTime() - WINDOW_MS[window];

  return history.filter((r) => r.timestamp.getTime() >= cutoff);
}

export function computeUptimePercent(history: StatusRecord[]): number | null {
  if (history.length === 0) return null;
  const alive = history.filter((r) => r.status === DomainStatus.Alive).length;
  return (alive / history.length) * 100;
}

export interface UptimeIncident {
  start: Date;
  end: Date;
  durationMs: number;
  status: DomainStatus.Down | DomainStatus.Error;
}

export function computeIncidents(history: StatusRecord[], now: Date = new Date()): UptimeIncident[] {
  const incidents: UptimeIncident[] = [];
  let current: UptimeIncident | null = null;

  for (const record of history) {
    const isDown = record.status === DomainStatus.Down || record.status === DomainStatus.Error;
    if (isDown) {
      if (!current) {
        current = {
          start: record.timestamp,
          end: record.timestamp,
          durationMs: 0,
          status: record.status === DomainStatus.Error ? DomainStatus.Error : DomainStatus.Down,
        };
      } else {
        current.end = record.timestamp;
      }
    } else if (current) {
      current.durationMs = Math.max(current.end.getTime() - current.start.getTime(), 60_000);
      incidents.push(current);
      current = null;
    }
  }

  if (current) {
    // Open incident: extend to now so ongoing outages aren't shown as 0ms
    current.end = now;
    current.durationMs = Math.max(current.end.getTime() - current.start.getTime(), 60_000);
    incidents.push(current);
  }

  return incidents;
}

export function formatDuration(ms: number): string {
  if (ms < 0) return '0m';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

export function formatMonitoringDuration(addedAt: Date, now: Date = new Date()): string {
  const ms = Math.max(0, now.getTime() - addedAt.getTime());
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years >= 1) {
    const remMonths = Math.floor((days % 365) / 30);
    return remMonths > 0 ? `${years}y ${remMonths}mo` : `${years}y`;
  }
  if (months >= 1) {
    const remDays = days % 30;
    return remDays > 0 ? `${months}mo ${remDays}d` : `${months}mo`;
  }
  if (days >= 1) return `${days}d`;
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h`;
  const minutes = Math.floor(ms / 60000);
  if (minutes >= 1) return `${minutes}m`;
  return 'Just added';
}

export function formatChartTimeLabel(date: Date, window: TimeWindow): string {
  if (window === '24h') {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (window === '7d' || window === '30d') {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export interface UptimeSummary {
  uptimePercent: number | null;
  totalChecks: number;
  monitoringDuration: string;
  longestIncidentMs: number;
  currentStreakMs: number;
  currentStreakStatus: 'up' | 'down' | 'unknown';
}

export function computeUptimeSummary(
  history: StatusRecord[],
  addedAt: Date,
  window: TimeWindow = 'since_added',
  now: Date = new Date(),
): UptimeSummary {
  const filtered = filterHistoryByWindow(history, addedAt, window, now);
  const incidents = computeIncidents(filtered, now);
  const longestIncidentMs = incidents.reduce((max, i) => Math.max(max, i.durationMs), 0);

  let currentStreakMs = 0;
  let currentStreakStatus: UptimeSummary['currentStreakStatus'] = 'unknown';

  if (filtered.length > 0) {
    const last = filtered[filtered.length - 1]!;
    const isUp = last.status === DomainStatus.Alive;
    currentStreakStatus = isUp ? 'up' : 'down';

    for (let i = filtered.length - 1; i >= 0; i--) {
      const record = filtered[i]!;
      if ((isUp && record.status === DomainStatus.Alive) || (!isUp && record.status !== DomainStatus.Alive)) {
        const prevTs = i > 0 ? filtered[i - 1]!.timestamp.getTime() : addedAt.getTime();
        currentStreakMs += record.timestamp.getTime() - prevTs;
      } else {
        break;
      }
    }
    currentStreakMs = Math.max(currentStreakMs, 0);
  }

  return {
    uptimePercent: computeUptimePercent(filtered),
    totalChecks: filtered.length,
    monitoringDuration: formatMonitoringDuration(addedAt, now),
    longestIncidentMs,
    currentStreakMs,
    currentStreakStatus,
  };
}
