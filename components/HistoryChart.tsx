import React, { useMemo } from 'react';
import { Domain, DomainStatus } from '../types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Activity, Clock } from 'lucide-react';

interface HistoryChartProps {
  domain: Domain;
}

interface ChartDataPoint {
  time: string;
  latency: number;
  status: DomainStatus;
  statusCode?: number;
}

export const HistoryChart: React.FC<HistoryChartProps> = ({ domain }) => {
  const chartData = useMemo(() => {
    return domain.history.map((record): ChartDataPoint => ({
      time: record.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latency: record.latency || 0,
      status: record.status,
      statusCode: record.statusCode
    }));
  }, [domain.history]);

  const stats = useMemo(() => {
    if (domain.history.length === 0) return null;

    const latencies = domain.history.filter(h => h.latency > 0).map(h => h.latency);
    const avgLatency = latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

    const uptime = domain.history.filter(h => h.status === DomainStatus.Alive).length / domain.history.length * 100;

    return {
      avgLatency: Math.round(avgLatency),
      minLatency: Math.round(minLatency),
      maxLatency: Math.round(maxLatency),
      uptime: uptime.toFixed(1),
      totalChecks: domain.history.length
    };
  }, [domain.history]);

  if (!stats) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <Activity size={48} className="mx-auto mb-3 opacity-50" />
        <p>No history data available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <Activity size={12} />
            <span>Avg</span>
          </div>
          <div className="text-lg font-bold text-white">{stats.avgLatency}ms</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <TrendingUp size={12} />
            <span>Min</span>
          </div>
          <div className="text-lg font-bold text-emerald-400">{stats.minLatency}ms</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <TrendingUp size={12} className="rotate-180" />
            <span>Max</span>
          </div>
          <div className="text-lg font-bold text-red-400">{stats.maxLatency}ms</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <Clock size={12} />
            <span>Uptime</span>
          </div>
          <div className="text-lg font-bold text-emerald-400">{stats.uptime}%</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-zinc-400 text-xs mb-1">
            <Activity size={12} />
            <span>Checks</span>
          </div>
          <div className="text-lg font-bold text-white">{stats.totalChecks}</div>
        </div>
      </div>

      {/* Latency Chart */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Response Time (ms)</h3>
        <div className="h-64 bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
          <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={200} debounce={100}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.5} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12, fill: '#71717a' }}
                axisLine={{ stroke: '#3f3f46' }}
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
                  color: '#e4e4e7'
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

      {/* Status Timeline */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">Status Timeline</h3>
        <div className="bg-zinc-900/80 rounded-xl border border-zinc-800 p-4">
          <div className="flex flex-wrap gap-1">
            {domain.history.slice(-50).map((record, i) => {
              const color = record.status === DomainStatus.Alive
                ? 'bg-emerald-500'
                : record.status === DomainStatus.Down
                  ? 'bg-rose-500'
                  : 'bg-zinc-700';
              
              const tooltip = `${record.timestamp.toLocaleString()} - ${record.status} (${record.latency}ms)`;
              
              return (
                <div
                  key={i}
                  className={`w-3 h-8 rounded ${color} flex-shrink-0`}
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
          </div>
        </div>
      </div>
    </div>
  );
};
