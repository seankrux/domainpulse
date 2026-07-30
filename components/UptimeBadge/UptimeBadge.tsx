import React from "react";
import { DomainStatus } from "../../types";

interface UptimeBadgeProps {
  history: { status: DomainStatus }[];
}

export const UptimeBadge: React.FC<UptimeBadgeProps> = ({ history }) => {
  if (history.length === 0) return <span className="text-zinc-700 text-xs">-</span>;

  const alive = history.filter((r) => r.status === DomainStatus.Alive).length;
  const pct = (alive / history.length) * 100;

  const c =
    pct >= 99
      ? { text: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" }
      : pct >= 95
        ? { text: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" }
        : { text: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-semibold border ${c.text} ${c.bg}`}
      title={`${alive}/${history.length} checks passed`}
    >
      {pct.toFixed(1)}%
    </span>
  );
};
