import React from "react";
import { Shield } from "lucide-react";
import { SSLInfo, SSLStatus } from "../../types";
import { sslColor, sslLabel } from "../../theme/statusColors";

interface SSLBadgeProps {
  ssl?: SSLInfo;
  onClick?: () => void;
}

export const SSLBadge: React.FC<SSLBadgeProps> = ({ ssl, onClick }) => {
  if (!ssl || ssl.status === SSLStatus.Unknown) {
    return (
      <button
        onClick={onClick}
        className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-emerald-400 transition-colors"
      >
        -
      </button>
    );
  }

  const colorClass = sslColor(ssl.status);
  const label = sslLabel(ssl.status);

  let displayLabel = label;
  if (ssl.daysUntilExpiry !== undefined && ssl.status === SSLStatus.Valid) {
    displayLabel = `${ssl.daysUntilExpiry}d`;
  } else if (ssl.status === SSLStatus.Expiring) {
    displayLabel = `${ssl.daysUntilExpiry}d`;
  }

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 ${colorClass}`}
      title={ssl.issuer || label}
    >
      <Shield size={10} strokeWidth={2.5} />
      {displayLabel}
    </button>
  );
};
