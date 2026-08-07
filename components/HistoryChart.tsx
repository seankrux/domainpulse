import React, { useMemo, useState } from 'react';
import { Domain, DomainStatus } from '../types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts';
import { TrendingUp, Activity, Clock, Calendar, AlertTriangle } from 'lucide-react';
import {
  TimeWindow,
  filterHistoryByWindow,
  computeUptimeSummary,
  formatChartTimeLabel,
  formatDuration,
  computeIncidents,
} from '../utils/uptimeStats';

interface HistoryChartProps {
  domain: Domain;
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  latency: number;
  uptime: number;
  status: DomainStatus;
  statusCode?: number;
}

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'since_added', label: 'Since Added' },
  { value: 'all', label: 'All' },
];

export const HistoryChart: React.FC<HistoryChartProps> = ({ domain }) => {
  const [window, setWindow] = useState<TimeWindow>('since_added');

  const filteredHistory = useMemo(
    () => filterHistoryByWindow(domain.history, domain.addedAt, window),
    [domain.history, domain.addedAt, window],
  );

  const summary = useMemo(
    () => computeUptimeSummary(domain.history, domain.addedAt, window),
    [domain.history, domain.addedAt, window],
  );

  const incidents = useMemo(
    () => computeIncidents(filteredHistory).slice(-5).reverse(),
    [filteredHistory],
  );

  const chartData = useMemo(() => {
    return filteredHistory.map((record): ChartDataPoint => ({
      time: formatChartTimeLabel(record.timestamp, window),
      timestamp: record.timestamp.getTime(),
      latency: record.latency || 0,
      uptime: record.status === DomainStatus.Alive ? 100 : 0,
      status: record.status,
      statusCode: record.statusCode,
    }));
  }, [filteredHistory, window]);

  if (domain.history.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <Activity size={48} className="mx-auto mb-3 opacity-50" />
        <p>No history data available yet</p>
        <p className="text-xs mt-2 text-zinc-500">
          Added {domain.addedAt.toLocaleDateString()} — checks will build your uptime graph over time
        </p>
      </div>
    );
  }

  const periodLabel =
    window === '24h' ? 'Last 24 hours'
      : window === '7d' ? 'Last 7 days'
        : window === '30d' ? 'Last 30 days'
          : summary.monitoringDuration;

  return (
    <div className="space-y-6">
      {/* Monitoring period header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-400 flex items-center gap-2">
            <Calendar size={14} />
            Monitored for <span className="text-white font-semibold">{summary.monitoringDuration}</span>
            <span className="text-zinc-600">·</span>
            Added {domain.addedAt.toLocaleDateString()}
          </p>
          {summary.currentStreakStatus !== 'unknown' && (
            <p className="text-xs text-zinc-500 mt-1">
              Current streak:{' '}
              <span className={summary.currentStreakStatus === 'up' ? 'text-emerald-400' : 'text-red-400'}>
                {summary.currentStreakStatus === 'up' ? 'Up' : 'Down'} for {formatDuration(summary.currentStreakMs)}
              </span>
            </p>
          )}
        </div>
        <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-lg border border-zinc-800">
          {TIME_WINDOWS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => setWindow(w.value)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                window === w.value
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {filteredHistory.length === 0 ? (
        <div className="text-center py-10 bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800 text-zinc-400">
          <p>No checks in this time window</p>
          <p className="text-xs mt-1 text-zinc-500">Try a wider range like Since Added or All</p>
        </div>
      ) : (
        <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <Clock size={12} />
            <span>Uptime</span>
          </div>
          <div className="text-lg font-bold text-emerald-400">
            {summary.uptimePercent !== null ? `${summary.uptimePercent.toFixed(1)}%` : '—'}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <Activity size={12} />
            <span>Checks</span>
          </div>
          <div className="text-lg font-bold text-white">{summary.totalChecks}</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <TrendingUp size={12} />
            <span>Avg Latency</span>
          </div>
          <div className="text-lg font-bold text-white">
            {chartData.length > 0
              ? `${Math.round(chartData.reduce((a, b) => a + b.latency, 0) / chartData.length)}ms`
              : '—'}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <AlertTriangle size={12} />
            <span>Longest Down</span>
          </div>
          <div className="text-lg font-bold text-red-400">
            {summary.longestIncidentMs > 0 ? formatDuration(summary.longestIncidentMs) : '—'}
          </div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <Calendar size={12} />
            <span>Period</span>
          </div>
          <div className="text-sm font-bold text-white">{periodLabel}</div>
        </div>
      </div>

      {/* Uptime bar chart */}
      {chartData.length >= 1 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Uptime Over Time</h3>
          <div className="h-32 bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
            <ResponsiveContainer width="100%" height="100%" minHeight={80} minWidth={200} debounce={100}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.3} vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#71717a' }}
                  axisLine={{ stroke: '#3f3f46' }}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(24, 24, 27, 0.95)',
                    border: '1px solid #3f3f46',
                    borderRadius: '12px',
                    color: '#e4e4e7',
                  }}
                  formatter={(_value, _name, props) => {
                    const payload = props.payload as ChartDataPoint;
                    return [
                      payload.status === DomainStatus.Alive ? 'Up' : 'Down',
                      `${payload.statusCode ?? '—'} · ${payload.latency}ms`,
                    ];
                  }}
                />
                <Bar dataKey="uptime" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.status === DomainStatus.Alive ? '#10b981' : entry.status === DomainStatus.Down ? '#f43f5e' : '#52525b'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Latency Chart */}
      {chartData.length >= 1 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Response Time (ms)</h3>
          <div className="h-64 bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200} debounce={100}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.5} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 12, fill: '#71717a' }}
                  axisLine={{ stroke: '#3f3f46' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#71717a' }}
                  axisLine={{ stroke: '#3f3f46' }}
                  label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#71717a' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(24, 24, 27, 0.95)',
                    border: '1px solid #3f3f46',
                    borderRadius: '12px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                    color: '#e4e4e7',
                  }}
                  labelStyle={{ color: '#a1a1aa', fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="latency"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#latencyGradient)"
                  name="Latency"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent incidents */}
      {incidents.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">Recent Incidents</h3>
          <div className="space-y-2">
            {incidents.map((incident, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2 bg-red-500/5 border border-red-500/20 rounded-lg text-sm">
                <span className="text-zinc-300">
                  {incident.start.toLocaleString()} — {incident.end.toLocaleString()}
                </span>
                <span className="text-red-400 font-mono text-xs">{formatDuration(incident.durationMs)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Status Timeline</h3>
        <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
          <div className="flex flex-wrap gap-1">
            {filteredHistory.slice(-100).map((record, i) => {
              const color =
                record.status === DomainStatus.Alive
                  ? 'bg-emerald-500'
                  : record.status === DomainStatus.Down
                    ? 'bg-rose-500'
                    : 'bg-zinc-700';

              const tooltip = `${record.timestamp.toLocaleString()} - ${record.status} (${record.latency}ms)`;

              return (
                <div
                  key={i}
                  className={`w-2 h-8 rounded-sm ${color} flex-shrink-0`}
                  title={tooltip}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-400">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span>Alive</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-rose-500" />
              <span>Down</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-zinc-700" />
              <span>Unknown</span>
            </div>
            <span className="ml-auto text-zinc-600">{filteredHistory.length} checks in period</span>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
