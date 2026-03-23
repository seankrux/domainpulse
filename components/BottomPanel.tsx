import React, { useState } from 'react';
import { ChevronUp, ChevronDown, AlertTriangle, Shield, Calendar, CheckCircle2 } from 'lucide-react';
import { Domain, SSLStatus } from '../types';
import { DistributionChart } from './StatsOverview';

interface BottomPanelProps {
  domains: Domain[];
  onViewDomain: (domainId: string) => void;
}

export const BottomPanel: React.FC<BottomPanelProps> = ({ domains, onViewDomain }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const alerts = React.useMemo(() => {
    const sslExpiring = domains.filter(d => d.ssl?.status === SSLStatus.Expiring || d.ssl?.status === SSLStatus.Expired);
    const domainExpiring = domains.filter(d => d.expiry?.status === 'expiring' || d.expiry?.status === 'expired');

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

    return combined.slice(0, 5);
  }, [domains]);

  const alertCount = alerts.length;
  const stats: import('../types').DomainStats = React.useMemo(() => {
    const alive = domains.filter(d => d.status === 'ALIVE').length;
    const down = domains.filter(d => d.status === 'DOWN').length;
    const unknown = domains.filter(d => d.status === 'UNKNOWN' || d.status === 'CHECKING').length;
    const responsiveDomains = domains.filter(d => d.latency !== undefined && d.latency > 0);
    const avgLatency = responsiveDomains.length > 0
      ? responsiveDomains.reduce((acc, curr) => acc + (curr.latency || 0), 0) / responsiveDomains.length
      : 0;
    const totalRecords = domains.reduce((acc, d) => acc + d.history.length, 0);
    const aliveRecords = domains.reduce((acc, d) =>
      acc + d.history.filter(h => h.status === 'ALIVE').length, 0);
    const uptime = totalRecords > 0 ? (aliveRecords / totalRecords) * 100 : 100;
    return { total: domains.length, alive, down, unknown, avgLatency, uptime };
  }, [domains]);

  if (domains.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Collapse/Expand Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 shadow-lg hover:bg-zinc-800/95 transition-all px-6 py-3 flex items-center justify-between group"
        aria-expanded={isExpanded}
        aria-controls="bottom-panel-content"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {alertCount > 0 ? (
              <div className="relative">
                <AlertTriangle size={20} className="text-amber-400" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {alertCount}
                </span>
              </div>
            ) : (
              <CheckCircle2 size={20} className="text-emerald-400" />
            )}
            <span className="text-sm font-semibold text-zinc-200">
              {alertCount > 0 ? `${alertCount} Alert${alertCount > 1 ? 's' : ''} Need Attention` : 'All Systems Operational'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {stats.alive} Alive
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              {stats.down} Down
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
              {stats.unknown} Unknown
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-zinc-500">
          <span className="text-xs font-medium hidden sm:inline">
            {isExpanded ? 'Collapse' : 'Expand'}
          </span>
          {isExpanded ? (
            <ChevronDown size={20} className="group-hover:scale-110 transition-transform" />
          ) : (
            <ChevronUp size={20} className="group-hover:scale-110 transition-transform" />
          )}
        </div>
      </button>

      {/* Expandable Content */}
      <div
        id="bottom-panel-content"
        className={`bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${
          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alerts Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-zinc-300 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-400" />
                  Urgent Attention
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-zinc-800 rounded text-zinc-500 border border-zinc-700">
                  {alerts.length} alerts
                </span>
              </div>

              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center bg-zinc-800/30 rounded-xl border border-dashed border-zinc-700">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mb-3 text-emerald-400">
                    <CheckCircle2 size={24} />
                  </div>
                  <p className="text-sm font-medium text-white">All assets secure</p>
                  <p className="text-xs text-zinc-500 mt-1">No expiring SSL or domains detected.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => onViewDomain(alert.domainId)}
                      className="w-full flex items-center justify-between p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl border border-zinc-700/50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          alert.severity === 'high'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {alert.type === 'SSL' ? <Shield size={14} /> : <Calendar size={14} />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{alert.url}</p>
                          <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">
                            {alert.type} {alert.status === 'expired' || alert.status === SSLStatus.Expired ? 'Expired' : `Expires in ${alert.days}d`}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Distribution Chart */}
            <div>
              <DistributionChart stats={stats} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
