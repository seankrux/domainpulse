import React from "react";
import { DomainGroup } from "../../types";

interface GroupBadgeProps {
  group?: DomainGroup;
}

export const GroupBadge: React.FC<GroupBadgeProps> = ({ group }) => {
  if (!group) return null;

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight shadow-sm"
      style={{
        backgroundColor: `${group.color}20`,
        color: group.color,
        border: `1px solid ${group.color}30`,
      }}
    >
      {group.name}
    </span>
  );
};
