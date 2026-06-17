import React from "react";
import { DomainStatus } from "../../types";

interface HistorySparklineProps {
  history: { status: DomainStatus; latency: number }[];
}

export const HistorySparkline: React.FC<HistorySparklineProps> = ({ history }) => {
  if (history.length === 0) return <span className="text-zinc-700">-</span>;

  const recentHistory = history.slice(-10);

  return (
    <div className="flex items-center gap-0.5" title={`${history.length} checks recorded`}>
      {recentHistory.map((record, i) => {
        const color =
          record.status === DomainStatus.Alive
            ? "bg-emerald-500"
            : record.status === DomainStatus.Down
              ? "bg-red-500"
              : "bg-zinc-700";
        const height =
          record.status === DomainStatus.Alive
            ? Math.max(4, Math.min(12, 12 - record.latency / 100))
            : 4;
        return (
          <div
            key={i}
            className={`w-1 rounded-full ${color} transition-all`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};
