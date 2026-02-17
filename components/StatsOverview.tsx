import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { DomainStats } from '../types';
import { Activity, AlertCircle, CheckCircle2, Globe, TrendingUp, Clock } from 'lucide-react';

interface StatsOverviewProps {
  stats: DomainStats;
}

const StatCard = ({ title, value, icon: Icon, colorClass, trend }: any) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-soft transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{title}</p>
        <h3 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${colorClass} bg-opacity-10 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={22} className={colorClass.replace('bg-', 'text-')} />
      </div>
    </div>
    {trend && (
      <div className="mt-4 flex items-center text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 w-fit px-2 py-1 rounded-full">
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
        colorClass="bg-indigo-500 text-indigo-600"
      />
      <StatCard
        title="Operational"
        value={stats.alive}
        icon={CheckCircle2}
        colorClass="bg-emerald-500 text-emerald-600"
      />
      <StatCard
        title="Issues Detected"
        value={stats.down}
        icon={AlertCircle}
        colorClass="bg-rose-500 text-rose-600"
      />
      <StatCard
        title="Avg. Latency"
        value={stats.avgLatency > 0 ? `${Math.round(stats.avgLatency)}ms` : '-'}
        icon={Activity}
        colorClass="bg-violet-500 text-violet-600"
      />
      {stats.uptime < 100 && (
        <StatCard
          title="Uptime"
          value={`${stats.uptime.toFixed(1)}%`}
          icon={Clock}
          colorClass="bg-amber-500 text-amber-600"
          trend={stats.uptime >= 99 ? `${stats.uptime.toFixed(1)}% availability` : undefined}
        />
      )}
    </div>
  );
};

export const DistributionChart: React.FC<{ stats: DomainStats }> = ({ stats }) => {
    const data = [
        { name: 'Alive', value: stats.alive },
        { name: 'Down', value: stats.down },
        { name: 'Unknown', value: stats.unknown },
    ].filter(i => i.value > 0);

    if (data.length === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 h-80 flex flex-col relative overflow-hidden">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider mb-2 z-10">Health Distribution</h3>
            <div className="flex-1 w-full min-h-0 z-10">
                <ResponsiveContainer width="100%" height="100%">
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
                        >
                            {data.map((entry, index) => {
                                let color = '#475569'; // Unknown (slate-600)
                                if (entry.name === 'Alive') color = '#10b981';
                                if (entry.name === 'Down') color = '#f43f5e';
                                return <Cell key={`cell-${index}`} fill={color} />;
                            })}
                        </Pie>
                        <Tooltip
                            contentStyle={{ 
                                borderRadius: '8px', 
                                border: 'none', 
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                backgroundColor: 'rgba(255,255,255,0.95)'
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        </div>
    )
}