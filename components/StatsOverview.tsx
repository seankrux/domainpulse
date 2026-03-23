import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DomainStats } from '../types';
import { Activity, AlertCircle, CheckCircle2, Globe, TrendingUp, Clock } from 'lucide-react';

interface StatsOverviewProps {
  stats: DomainStats;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  glowColor?: string;
  trend?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon: Icon, iconColor, glowColor, trend }) => (
  <div className="glass-card rounded-2xl p-6 hover:border-zinc-700 transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-zinc-500 mb-1">{title}</p>
        <h3 className="text-3xl font-display font-bold text-white tracking-tight">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-zinc-800/80 group-hover:scale-110 transition-transform duration-300 ${glowColor || ''}`}>
        <Icon size={22} className={iconColor} />
      </div>
    </div>
    {trend && (
      <div className="mt-4 flex items-center text-xs font-medium text-emerald-400 bg-emerald-500/10 w-fit px-2 py-1 rounded-full border border-emerald-500/20">
        <TrendingUp size={12} className="mr-1" />
        {trend}
      </div>
    )}
  </div>
);

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Monitored"
        value={stats.total}
        icon={Globe}
        iconColor="text-blue-400"
      />
      <StatCard
        title="Operational"
        value={stats.alive}
        icon={CheckCircle2}
        iconColor="text-emerald-400"
        glowColor="shadow-glow-emerald"
      />
      <StatCard
        title="Issues Detected"
        value={stats.down}
        icon={AlertCircle}
        iconColor="text-red-400"
        glowColor={stats.down > 0 ? "shadow-glow-red" : ""}
      />
      <StatCard
        title="Avg. Latency"
        value={stats.avgLatency > 0 ? `${Math.round(stats.avgLatency)}ms` : '-'}
        icon={Activity}
        iconColor="text-violet-400"
      />
      {stats.uptime < 100 && (
        <StatCard
          title="Uptime"
          value={`${stats.uptime.toFixed(1)}%`}
          icon={Clock}
          iconColor="text-amber-400"
          trend={stats.uptime >= 99 ? `${stats.uptime.toFixed(1)}% availability` : undefined}
        />
      )}
    </div>
  );
};

const DistributionChartInner: React.FC<{ stats: DomainStats }> = ({ stats }) => {
    const data = React.useMemo(() => [
        { name: 'Alive', value: stats.alive },
        { name: 'Down', value: stats.down },
        { name: 'Unknown', value: stats.unknown },
    ].filter(i => i.value > 0), [stats.alive, stats.down, stats.unknown]);

    if (data.length === 0 || stats.total === 0) {
        return (
            <div className="glass-card rounded-2xl p-6 h-[320px] flex flex-col items-center justify-center">
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-2">Health Distribution</h3>
                <p className="text-zinc-500 text-sm">No data available</p>
            </div>
        );
    }

    return (
        <div className="glass-card rounded-2xl p-6 h-[320px] min-h-[320px] flex flex-col relative overflow-hidden">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-2 z-10">Health Distribution</h3>
            <div className="flex-1 w-full min-h-[240px] z-10">
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                            isAnimationActive={false}
                        >
                            {data.map((entry, index) => {
                                let color = '#52525b'; // Unknown (zinc-600)
                                if (entry.name === 'Alive') color = '#10b981';
                                if (entry.name === 'Down') color = '#ef4444';
                                return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                        </Pie>
                        <Tooltip
                            contentStyle={{
                                borderRadius: '12px',
                                border: '1px solid #3f3f46',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                                color: '#e4e4e7'
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        </div>
    );
};

export const DistributionChart = React.memo(DistributionChartInner);
DistributionChart.displayName = 'DistributionChart';
