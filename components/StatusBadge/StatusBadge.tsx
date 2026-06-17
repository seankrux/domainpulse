import React from "react";
import { DomainStatus } from "../../types";
import { STATUS_COLORS } from "../../theme/statusColors";

interface StatusBadgeProps {
  status: DomainStatus;
  statusCode?: number;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, statusCode }) => {
  const config = STATUS_COLORS[status];

  let displayText =
    status === DomainStatus.Checking
      ? "Checking..."
      : status.charAt(0) + status.slice(1).toLowerCase();

  if (statusCode && status !== DomainStatus.Checking && status !== DomainStatus.Unknown) {
    displayText = `${statusCode}`;
    if (statusCode === 200) displayText = "200 OK";
  }

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${config.bg} ${config.text} border ${config.border} shadow-sm transition-all hover:shadow-md whitespace-nowrap`}
    >
      <span
        className={`w-2 h-2 rounded-full ${config.dot} ${status === DomainStatus.Checking ? "animate-pulse" : ""} shadow-glow`}
      />
      {displayText}
    </span>
  );
};
