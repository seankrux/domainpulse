import React from "react";
import { PhoneCall } from "lucide-react";
import { CallCheckStatus, type CallButtonResult } from "../../types";
import { callCheckColor, callCheckLabel } from "../../theme/statusColors";

interface CallCheckBadgeProps {
  check?: { status: CallCheckStatus; results: CallButtonResult[] };
  onClick?: () => void;
}

export const CallCheckBadge: React.FC<CallCheckBadgeProps> = ({ check, onClick }) => {
  if (!check || check.status === CallCheckStatus.Unknown) {
    return (
      <button
        onClick={onClick}
        className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-emerald-400 transition-colors"
      >
        -
      </button>
    );
  }

  const colorClass = callCheckColor(check.status);
  const label = callCheckLabel(check.status);
  const count = check.results?.length ?? 0;
  const swapped = check.results?.filter((r) => r.numberSwapped).length ?? 0;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 ${colorClass}`}
      title={`${count} call button(s), ${swapped} with CallRail number swapped`}
    >
      <PhoneCall size={10} strokeWidth={2.5} />
      {label}
    </button>
  );
};
