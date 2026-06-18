import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { DomainStats } from "../types";
import { CHART_COLORS } from "../theme/statusColors";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Globe,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
} from "lucide-react";

interface StatsOverviewProps {
  stats: DomainStats;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  glowColor?: string;
  trendLabel?: string;
  trendDir?: 'up' | 'down' | 'stable';
}

const TrendIcon: React.FC<{ dir: 'up' | 'down' | 'stable' | undefined }> = ({ dir }) => {
  if (dir === 'up')    return <TrendingUp size={12} />;
  if (dir === 'down')  return <TrendingDown size={12} />;
  return <Minus size={12} />;
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor,
  glowColor,
  trendLabel,
  trendDir,
}) => (
  <div className="glass-card rounded-2xl p-6 hover:border-zinc-600 hover:bg-zinc-850/90 hover:-translate-y-0.5 transition-all duration-300 group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">{title}</p>
        <h3 className="text-3xl font-display font-bold text-white tracking-tight">
          {value}
        </h3>
      </div>
      <div
        className={`p-3 rounded-xl bg-zinc-800/80 group-hover:scale-110 transition-transform duration-300 ${glowColor || ""}`}
      >
        <Icon size={22} className={iconColor} />
      </div>
    </div>
    {trendDir && (
      <div className={`mt-4 flex items-center text-xs font-medium w-fit px-2 py-1 rounded-full border ${
        trendDir === 'up'
          ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
          : trendDir === 'down'
          ? 'text-red-400 bg-red-500/10 border-red-500/20'
          : 'text-zinc-400 bg-zinc-800 border-zinc-700'
      }`}>
        <TrendIcon dir={trendDir} />
        {trendLabel && <span className="ml-1">{trendLabel}</span>}
      </div>
    )}
  </div>
);

interface KpiDef {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  glowColor?: string;
  trendDir?: 'up' | 'down' | 'stable';
  trendLabel?: string;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  const t = stats.trends;
  const kpis: KpiDef[] = [
    { title: "Total Monitored", value: stats.total, icon: Globe, iconColor: "text-emerald-400" },
  ];

  if (stats.total > 0) {
    kpis.push({
      title: "Operational", value: stats.alive, icon: CheckCircle2, iconColor: "text-emerald-400",
      glowColor: "shadow-glow-emerald", trendDir: t?.alive,
    });
    if (stats.down > 0) {
      kpis.push({
        title: "Issues Detected", value: stats.down, icon: AlertCircle, iconColor: "text-red-400",
        glowColor: "shadow-glow-red", trendDir: t?.down,
      });
    }
    kpis.push({
      title: "Avg. Latency", value: stats.avgLatency > 0 ? `${Math.round(stats.avgLatency)}ms` : "\u2014",
      icon: Activity, iconColor: "text-emerald-400", trendDir: t?.latency,
    });
    kpis.push({
      title: "Uptime", value: `${stats.uptime.toFixed(1)}%`,
      icon: Clock,
      iconColor: stats.uptime >= 99 ? "text-emerald-400" : stats.uptime >= 95 ? "text-amber-400" : "text-red-400",
      trendDir: t?.uptime,
      trendLabel: stats.uptime >= 99.9 ? "99.9% SLA met" : undefined,
    });
  }

  const cols = Math.min(kpis.length, 4);
  const gridCols = `repeat(${cols}, 1fr)`;

  return (
    <div
      className="grid gap-6 mb-8"
      style={{ gridTemplateColumns: gridCols }}
    >
      {kpis.map((kpi) => (
        <StatCard key={kpi.title} {...kpi} />
      ))}
    </div>
  );
};

const DistributionChartInner: React.FC<{ stats: DomainStats }> = ({
  stats,
}) => {
  const data = React.useMemo(
    () =>
      [
        { name: "Alive", value: stats.alive },
        { name: "Down", value: stats.down },
        { name: "Unknown", value: stats.unknown },
      ].filter((i) => i.value > 0),
    [stats.alive, stats.down, stats.unknown],
  );

  if (data.length === 0 || stats.total === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 h-[320px] flex flex-col items-center justify-center">
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Health Distribution
        </h3>
        <p className="text-zinc-500 text-sm">No data available</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 h-[320px] min-h-[320px] flex flex-col relative overflow-hidden">
      <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-2 z-10">
        Health Distribution
      </h3>
      <div className="flex-1 w-full min-h-[240px] z-10 relative">
        {/* Center total label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="text-center">
            <span className="text-2xl font-display font-bold text-white">{stats.total}</span>
            <p className="text-[10px] text-zinc-400 uppercase tracking-wider mt-0.5">total</p>
          </div>
        </div>
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
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.name] ?? CHART_COLORS.Unknown} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #3f3f46",
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                backgroundColor: "rgba(24, 24, 27, 0.95)",
                color: "#e4e4e7",
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
DistributionChart.displayName = "DistributionChart";
