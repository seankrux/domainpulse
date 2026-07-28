import React from "react";
import { DomainStatus } from "../../types";

interface HistorySparklineProps {
  history: { status: DomainStatus; latency: number }[];
}

export const HistorySparkline: React.FC<HistorySparklineProps> = ({ history }) => {
  if (history.length === 0) return <span className="text-zinc-700">-</span>;

  const recentHistory = history.slice(-20);
  const aliveCount = recentHistory.filter((r) => r.status === DomainStatus.Alive).length;
  const uptimePct = ((aliveCount / recentHistory.length) * 100).toFixed(0);

  return (
    <div
      className="flex items-center gap-1.5"
      title={`${history.length} checks · last ${recentHistory.length}: ${uptimePct}% up`}
    >
      <div className="flex items-end gap-0.5 h-4">
        {recentHistory.map((record, i) => {
          const color =
            record.status === DomainStatus.Alive
              ? "bg-emerald-500"
              : record.status === DomainStatus.Down
                ? "bg-red-500"
                : "bg-zinc-700";
          const height =
            record.status === DomainStatus.Alive
              ? Math.max(4, Math.min(16, 16 - record.latency / 80))
              : 4;
          return (
            <div
              key={i}
              className={`w-0.5 rounded-full ${color} transition-all`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
    </div>
  );
};
