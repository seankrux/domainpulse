import React from "react";
import { FileCheck } from "lucide-react";
import { FormCheckStatus, type FormResult } from "../../types";
import { formCheckColor, formCheckLabel } from "../../theme/statusColors";

interface FormCheckBadgeProps {
  check?: { status: FormCheckStatus; results: FormResult[] };
  onClick?: () => void;
}

export const FormCheckBadge: React.FC<FormCheckBadgeProps> = ({ check, onClick }) => {
  if (!check || check.status === FormCheckStatus.Unknown) {
    return (
      <button
        onClick={onClick}
        className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-emerald-400 transition-colors"
      >
        -
      </button>
    );
  }

  const colorClass = formCheckColor(check.status);
  const label = formCheckLabel(check.status);
  const count = check.results?.length ?? 0;
  const failed = check.results?.filter((r) => r.status === FormCheckStatus.Fail).length ?? 0;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 ${colorClass}`}
      title={`${count} form(s) checked, ${failed} failed`}
    >
      <FileCheck size={10} strokeWidth={2.5} />
      {label}
    </button>
  );
};
