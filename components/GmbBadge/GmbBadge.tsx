import React from "react";
import { MapPin, Star } from "lucide-react";
import { GmbStatus, type GmbInfo } from "../../types";
import { gmbColor, gmbLabel } from "../../theme/statusColors";

interface GmbBadgeProps {
  gmb?: GmbInfo;
  /** Whether this domain has a Place ID configured (controls the empty state). */
  configured?: boolean;
  onClick?: () => void;
}

export const GmbBadge: React.FC<GmbBadgeProps> = ({ gmb, configured, onClick }) => {
  if (!gmb || gmb.status === GmbStatus.Unknown) {
    return (
      <button
        onClick={onClick}
        className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-emerald-400 transition-colors"
        title={configured ? "GMB check pending — run a check" : "No GMB Place ID set"}
      >
        {configured ? "•" : "-"}
      </button>
    );
  }

  const colorClass = gmbColor(gmb.status);
  const showRating = gmb.status === GmbStatus.Operational && typeof gmb.rating === "number";
  const title = [
    gmb.name,
    gmb.rating != null ? `${gmb.rating}★ (${gmb.reviewCount ?? 0} reviews)` : null,
    gmb.businessStatus,
    gmb.error,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 ${colorClass}`}
      title={title || gmbLabel(gmb.status)}
    >
      <MapPin size={10} strokeWidth={2.5} />
      {showRating ? (
        <span className="inline-flex items-center gap-0.5">
          {gmb.rating!.toFixed(1)}
          <Star size={9} strokeWidth={2.5} className="fill-current" />
        </span>
      ) : (
        gmbLabel(gmb.status)
      )}
    </button>
  );
};
