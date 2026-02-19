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
    
    // Sort by urgency
    const combined = [
      ...sslExpiring.map(d => ({ 
        id: `ssl-${d.id}`, 
        domainId: d.id,
        url: d.url, 
        type: 'SSL', 
        status: d.ssl?.status, 
        days: d.ssl?.daysUntilExpiry,
        severity: d.ssl?.status === SSLStatus.Expired ? 'high' : 'medium'
      })),
      ...domainExpiring.map(d => ({ 
        id: `expiry-${d.id}`, 
        domainId: d.id,
        url: d.url, 
        type: 'Domain', 
        status: d.expiry?.status, 
        days: d.expiry?.daysUntilExpiry,
        severity: d.expiry?.status === 'expired' ? 'high' : 'medium'
      }))
    ].sort((a, b) => (a.days || 0) - (b.days || 0));

    return combined.slice(0, 5); // Only show top 5
  }, [domains]);

  if (domains.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500" />
          Urgent Attention
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-500">{alerts.length} alerts</span>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-2 text-emerald-500">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">All assets secure</p>
          <p className="text-xs text-slate-500 mt-1">No expiring SSL or domains detected.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <button
              key={alert.id}
              onClick={() => onViewDomain(alert.domainId)}
              className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600 transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-2 rounded-lg ${alert.severity === 'high' ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                  {alert.type === 'SSL' ? <Shield size={14} /> : <Calendar size={14} />}
                </div>
                <div className="text-left overflow-hidden">
                  <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{alert.url}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tighter">
                    {alert.type} {alert.status === 'expired' || alert.status === SSLStatus.Expired ? 'Expired' : `Expires in ${alert.days}d`}
                  </p>
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
