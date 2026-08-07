import React from "react";
import { Activity } from "lucide-react";
import { DomainHealthInfo, LetterGrade } from "../types";
import { healthGradeColor } from "../theme/statusColors";

interface HealthBadgeProps {
  health?: DomainHealthInfo;
  onClick?: () => void;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({ health, onClick }) => {
  if (!health) {
    return (
      <button
        onClick={onClick}
        className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-emerald-400 transition-colors"
      >
        -
      </button>
    );
  }

  const grade: LetterGrade = health.grade;
  const colorClass = healthGradeColor(grade);

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 ${colorClass}`}
      title={`Health ${health.score}/${health.maxScore}`}
    >
      <Activity size={10} strokeWidth={2.5} />
      {grade}
    </button>
  );
};
