import React, { useMemo } from 'react';
import { Domain, SSLStatus } from '../types';
import { Shield, Calendar, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';

interface AlertSummaryProps {
  domains: Domain[];
  onViewDomain: (domainId: string) => void;
}

export const AlertSummary: React.FC<AlertSummaryProps> = ({ domains, onViewDomain }) => {
  const alerts = useMemo(() => {
    const sslExpiring = domains.filter(d => d.ssl?.status === SSLStatus.Expiring || d.ssl?.status === SSLStatus.Expired);
    const domainExpiring = domains.filter(d => d.expiry?.status === 'expiring' || d.expiry?.status === 'expired');

    const combined = [
      ...sslExpiring.map(d => ({
        id: `ssl-${d.id}`,
        domainId: d.id,
        url: d.url,
        type: 'SSL' as const,
        status: d.ssl?.status,
        days: d.ssl?.daysUntilExpiry,
        severity: d.ssl?.status === SSLStatus.Expired ? 'high' as const : 'medium' as const,
      })),
      ...domainExpiring.map(d => ({
        id: `expiry-${d.id}`,
        domainId: d.id,
        url: d.url,
        type: 'Domain' as const,
        status: d.expiry?.status,
        days: d.expiry?.daysUntilExpiry,
        severity: d.expiry?.status === 'expired' ? 'high' as const : 'medium' as const,
      })),
    ].sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

    return combined.slice(0, 5);
  }, [domains]);

  if (domains.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-6 border border-zinc-800/80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-zinc-300 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          Urgent Attention
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-800 rounded text-zinc-400 border border-zinc-700">{alerts.length} alerts</span>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center mb-2 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-sm font-medium text-zinc-100">All assets secure</p>
          <p className="text-xs text-zinc-400 mt-1">No expiring SSL or domains detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              type="button"
              onClick={() => onViewDomain(alert.domainId)}
              className="w-full flex items-center justify-between p-3 bg-zinc-900/60 hover:bg-zinc-800/80 rounded-xl border border-zinc-800 transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-2 rounded-lg ${alert.severity === 'high' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  {alert.type === 'SSL' ? <Shield size={14} /> : <Calendar size={14} />}
                </div>
                <div className="text-left overflow-hidden">
                  <p className="text-xs font-bold truncate text-zinc-100">{alert.url}</p>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-tighter">
                    {alert.type} {alert.status === 'expired' || alert.status === SSLStatus.Expired ? 'Expired' : `Expires in ${alert.days}d`}
                  </p>
                </div>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-zinc-300 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
