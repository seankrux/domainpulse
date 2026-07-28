import React from 'react';
import { CanonicalCheckInfo } from '../../types';
import { CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';

interface CanonicalBadgeProps {
  canonical?: CanonicalCheckInfo;
  onClick?: () => void;
}

const VARIANT_LABELS: Record<string, string> = {
  https_apex: 'HTTPS',
  https_www: 'HTTPS www',
  http_apex: 'HTTP',
  http_www: 'HTTP www',
};

export const CanonicalBadge: React.FC<CanonicalBadgeProps> = ({ canonical, onClick }) => {
  if (!canonical || canonical.variants.length === 0) {
    return <span className="text-zinc-600 text-xs">-</span>;
  }

  const color =
    canonical.status === 'correct'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
      : canonical.status === 'issues'
        ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        : 'text-zinc-400 bg-zinc-800 border-zinc-700';

  const Icon =
    canonical.status === 'correct' ? CheckCircle : canonical.status === 'issues' ? AlertTriangle : HelpCircle;

  const label =
    canonical.status === 'correct'
      ? canonical.preferredHost === 'www'
        ? 'HTTPS www'
        : 'HTTPS'
      : canonical.status === 'issues'
        ? `${canonical.issues.length} issue${canonical.issues.length === 1 ? '' : 's'}`
        : 'Unknown';

  const tooltip = [
    canonical.canonicalUrl ? `Canonical: ${canonical.canonicalUrl}` : null,
    ...canonical.issues,
    ...canonical.variants.map(
      (v) => `${VARIANT_LABELS[v.variant] ?? v.variant}: ${v.statusCode || '—'} → ${v.finalUrl}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors hover:opacity-80 ${color}`}
      title={tooltip}
    >
      <Icon size={10} />
      {label}
    </button>
  );
};
