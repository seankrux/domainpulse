import React from "react";
import { Calendar } from "lucide-react";
import { DomainExpiry } from "../../types";
import { expiryColor, expiryLabel } from "../../theme/statusColors";

interface ExpiryBadgeProps {
  expiry?: DomainExpiry;
  onClick?: () => void;
}

export const ExpiryBadge: React.FC<ExpiryBadgeProps> = ({ expiry, onClick }) => {
  if (!expiry || expiry.status === "unknown") {
    return (
      <button
        onClick={onClick}
        className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-emerald-400 transition-colors"
      >
        -
      </button>
    );
  }

  const colorClass = expiryColor(expiry.status);
  const label = expiryLabel(expiry.status);

  let displayLabel = label;
  if (expiry.daysUntilExpiry !== undefined && expiry.status === "active") {
    displayLabel = `${expiry.daysUntilExpiry}d`;
  } else if (expiry.status === "expiring") {
    displayLabel = `${expiry.daysUntilExpiry}d`;
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 ${colorClass}`}
      title={expiry.registrar || label}
    >
      <Calendar size={10} strokeWidth={2.5} />
      {displayLabel}
    </button>
  );
};
