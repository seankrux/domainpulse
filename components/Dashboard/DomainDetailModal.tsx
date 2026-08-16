import React, { useEffect, useState } from 'react';
import { X, Shield, Calendar, Server, Hash, Activity, Clock, ExternalLink, Info, CheckCircle, AlertCircle, Link2, Code, ShoppingCart, BarChart3, MapPin, Star, Phone, RefreshCw, ArrowRight, AlertTriangle, Mail, Lock } from 'lucide-react';
import { Domain, DomainStatus, SSLStatus, GmbStatus } from '../../types';
import { sslColor, sslLabel, expiryColor, expiryLabel, gmbColor, gmbLabel, STATUS_COLORS, healthGradeColor } from '../../theme/statusColors';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getTechStackColor } from '../../components/TechStackBadge';
import { HistoryChart } from '../HistoryChart';
import { formatMonitoringDuration } from '../../utils/uptimeStats';

interface DomainDetailModalProps {
  domain: Domain;
  onClose: () => void;
  onSetGmbPlaceId?: (id: string, placeId: string) => void;
  onCheckGmb?: (id: string, placeId: string) => void;
}

export const DomainDetailModal: React.FC<DomainDetailModalProps> = ({ domain, onClose, onSetGmbPlaceId, onCheckGmb }) => {
  const [placeIdInput, setPlaceIdInput] = useState(domain.gmbPlaceId ?? '');
  // Trap focus within modal
  const modalContentRef = useFocusTrap({
    enabled: true,
    onEscape: onClose
  });

  // Announce modal to screen readers - using stable live region container
  useEffect(() => {
    let liveRegion = document.getElementById('domainpulse-aria-live-region');
    if (!liveRegion) {
      liveRegion = document.createElement('div');
      liveRegion.id = 'domainpulse-aria-live-region';
      liveRegion.setAttribute('role', 'status');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('class', 'sr-only');
      document.body.appendChild(liveRegion);
    }
    liveRegion.textContent = `Domain details dialog opened for ${domain.url}`;

    return () => {
      if (liveRegion) {
        liveRegion.textContent = '';
      }
    };
  }, [domain.url]);

  return (
    <div 
      data-testid="detail-modal" 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" 
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalContentRef}
        className="bg-zinc-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md px-6 py-4 border-b border-zinc-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/20">
              {domain.url.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 id="modal-title" className="text-xl font-bold text-white flex items-center gap-2">
                {domain.url}
                <a href={`https://${domain.url}`} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-emerald-400">
                  <ExternalLink size={16} />
                  <span className="sr-only">Open in new tab</span>
                </a>
              </h2>
              <p id="modal-description" className="sr-only">
                Domain status: {
                  domain.status === DomainStatus.Alive ? 'Online'
                    : domain.status === DomainStatus.Down ? 'Offline'
                      : domain.status === DomainStatus.Checking ? 'Checking'
                        : domain.status === DomainStatus.Error ? 'Error'
                          : 'Unknown'
                }
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[domain.status].dot}`} aria-hidden="true" />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  {/* HTTP code only for Alive/Down — never render a stale code
                      under Error/Unknown/Checking (AGENTS.md §3). */}
                  {domain.status} {domain.statusCode && (domain.status === DomainStatus.Alive || domain.status === DomainStatus.Down) ? `(${domain.statusCode})` : ''}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close domain details dialog"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Activity size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Latency</span>
              </div>
              <p className="text-lg font-bold text-white">{domain.latency ? `${domain.latency}ms` : '-'}</p>
            </div>
            <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Clock size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Last Check</span>
              </div>
              <p className="text-sm font-bold text-white">
                {domain.lastChecked ? new Date(domain.lastChecked).toLocaleTimeString() : 'Never'}
              </p>
            </div>
            <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Hash size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Checks</span>
              </div>
              <p className="text-lg font-bold text-white">{domain.history.length}</p>
            </div>
            <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-400 mb-1">
                <Calendar size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Monitored</span>
              </div>
              <p className="text-sm font-bold text-white">{formatMonitoringDuration(domain.addedAt)}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Since {domain.addedAt.toLocaleDateString()}</p>
            </div>
          </div>

          {/* Uptime History */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">Uptime History</h3>
            </div>
            <HistoryChart domain={domain} />
          </section>

          {/* HTTPS / Canonical Check */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Link2 className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">HTTPS & Canonical URLs</h3>
              {domain.canonical && (
                <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded border ${
                  domain.canonical.status === 'correct'
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : domain.canonical.status === 'issues'
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-zinc-400 bg-zinc-800 border-zinc-700'
                }`}>
                  {domain.canonical.status === 'correct' ? 'Configured' : domain.canonical.status === 'issues' ? 'Issues Found' : 'Unknown'}
                </span>
              )}
            </div>
            {domain.canonical && domain.canonical.variants.length > 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                {domain.canonical.canonicalUrl && (
                  <div className="px-4 py-3 border-b border-zinc-800 bg-emerald-500/5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Canonical URL</p>
                    <p className="text-sm font-mono text-emerald-400">{domain.canonical.canonicalUrl}</p>
                  </div>
                )}
                <div className="p-4 space-y-2">
                  {domain.canonical.variants.map((v) => {
                    const labels: Record<string, string> = {
                      https_apex: 'https://domain',
                      https_www: 'https://www.domain',
                      http_apex: 'http://domain',
                      http_www: 'http://www.domain',
                    };
                    return (
                      <div key={v.variant} className="flex items-center gap-2 text-xs bg-zinc-800/50 rounded-lg px-3 py-2">
                        <span className="font-mono text-zinc-400 w-28 shrink-0">{labels[v.variant]}</span>
                        <ArrowRight size={12} className="text-zinc-600 shrink-0" />
                        <span className={`font-mono truncate ${v.reachable ? 'text-zinc-200' : 'text-zinc-600'}`}>
                          {v.finalUrl || 'No response'}
                        </span>
                        <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          v.reachable ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                        }`}>
                          {v.statusCode || '—'}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {domain.canonical.issues.length > 0 && (
                  <div className="px-4 py-3 bg-amber-500/5 border-t border-zinc-800">
                    {domain.canonical.issues.map((issue, i) => (
                      <p key={i} className="text-xs text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle size={12} /> {issue}
                      </p>
                    ))}
                  </div>
                )}
                <div className="px-4 py-3 border-t border-zinc-800 flex gap-4 text-xs">
                  <span className={domain.canonical.httpsEnforced ? 'text-emerald-400' : 'text-amber-400'}>
                    {domain.canonical.httpsEnforced ? '✓' : '✗'} HTTPS enforced
                  </span>
                  <span className={domain.canonical.wwwConsistent ? 'text-emerald-400' : 'text-amber-400'}>
                    {domain.canonical.wwwConsistent ? '✓' : '✗'} www consistent
                  </span>
                </div>
              </div>
            ) : domain.canonical && domain.canonical.issues.length > 0 ? (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-2">
                {domain.canonical.issues.map((issue, i) => (
                  <p key={i} className="text-xs text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {issue}
                  </p>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">Run a check to analyse HTTP/HTTPS and www redirects.</p>
              </div>
            )}
          </section>

          {/* Domain Health */}
          {domain.health && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="text-emerald-400" size={18} />
                <h3 className="font-bold text-white">Domain Health</h3>
                <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded border ${healthGradeColor(domain.health.grade)}`}>
                  {domain.health.grade}
                </span>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Composite score</span>
                  <span className="font-mono text-zinc-200">{domain.health.score}/{domain.health.maxScore}</span>
                </div>
                <div className="p-4 space-y-2">
                  {domain.health.factors.map((f) => (
                    <div key={f.name} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-zinc-300 font-medium">{f.name}</span>
                        {f.note && <span className="text-zinc-500 ml-2">{f.note}</span>}
                      </div>
                      <span className="font-mono text-zinc-400">{f.score}/{f.max}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* SSL Information */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">SSL Certificate</h3>
            </div>
            {domain.ssl && domain.ssl.status !== SSLStatus.Unknown ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className={`px-4 py-3 border-b border-zinc-800 flex justify-between items-center ${sslColor(domain.ssl.status)}`}>
                  <span className="text-xs font-bold uppercase tracking-wider">{sslLabel(domain.ssl.status)}</span>
                  <span className="text-xs font-bold">{domain.ssl.daysUntilExpiry} days remaining</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Issuer</p>
                    <p className="font-medium text-zinc-200">{domain.ssl.issuer || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Valid From</p>
                    <p className="font-medium text-zinc-200">
                      {domain.ssl.validFrom ? new Date(domain.ssl.validFrom).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Valid To</p>
                    <p className="font-medium text-zinc-200">
                      {domain.ssl.validTo ? new Date(domain.ssl.validTo).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Days Remaining</p>
                    <p className="font-medium text-zinc-200">{domain.ssl.daysUntilExpiry ?? '—'}</p>
                  </div>
                  {domain.ssl.protocol && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Protocol</p>
                      <p className="font-medium text-zinc-200 font-mono text-xs">{domain.ssl.protocol}</p>
                    </div>
                  )}
                  {domain.ssl.cipher && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Cipher</p>
                      <p className="font-medium text-zinc-200 font-mono text-xs break-all">{domain.ssl.cipher}</p>
                    </div>
                  )}
                  {domain.ssl.fingerprint256 && (
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Fingerprint (SHA-256)</p>
                      <p className="font-medium text-zinc-400 font-mono text-[10px] break-all">{domain.ssl.fingerprint256}</p>
                    </div>
                  )}
                  {domain.ssl.grade && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">TLS Grade</p>
                      <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded border ${healthGradeColor(domain.ssl.grade)}`}>
                        {domain.ssl.grade}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">No SSL information available for this domain.</p>
              </div>
            )}
          </section>

          {/* Domain Expiry & WHOIS Information */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">Domain Registration & WHOIS</h3>
            </div>
            {domain.expiry && domain.expiry.status !== 'unknown' ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className={`px-4 py-3 border-b border-zinc-800 flex justify-between items-center ${expiryColor(domain.expiry.status)}`}>
                  <span className="text-xs font-bold uppercase tracking-wider">{expiryLabel(domain.expiry.status)}</span>
                  <span className="text-xs font-bold">{domain.expiry.daysUntilExpiry} days remaining</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Registrar</p>
                    <p className="font-medium text-zinc-200">{domain.expiry.registrar || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Expiry Date</p>
                    <p className="font-medium text-zinc-200">
                      {domain.expiry.expiryDate ? new Date(domain.expiry.expiryDate).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
                  {domain.expiry.createdDate && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Created Date</p>
                      <p className="font-medium text-zinc-200">
                        {new Date(domain.expiry.createdDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {domain.expiry.updatedDate && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Last Updated</p>
                      <p className="font-medium text-zinc-200">
                        {new Date(domain.expiry.updatedDate).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                  {domain.expiry.registrarIanaId && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Registrar IANA ID</p>
                      <p className="font-medium text-zinc-200">{domain.expiry.registrarIanaId}</p>
                    </div>
                  )}
                  {domain.expiry.registrarUrl && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Registrar URL</p>
                      <a href={domain.expiry.registrarUrl} target="_blank" rel="noreferrer" className="font-medium text-emerald-400 hover:underline text-xs break-all">
                        {domain.expiry.registrarUrl}
                      </a>
                    </div>
                  )}
                  {domain.expiry.dnssec && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">DNSSEC</p>
                      <div className="flex items-center gap-1">
                        {domain.expiry.dnssec === 'signed' || domain.expiry.dnssec === 'signedDelegation' ? (
                          <CheckCircle size={14} className="text-emerald-500" />
                        ) : (
                          <AlertCircle size={14} className="text-amber-500" />
                        )}
                        <span className="font-medium text-zinc-200">{domain.expiry.dnssec}</span>
                      </div>
                    </div>
                  )}
                </div>
                {domain.expiry.domainStatus && domain.expiry.domainStatus.length > 0 && (
                  <div className="px-4 py-3 bg-zinc-800/30 border-t border-zinc-800">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-wider">Domain Status</p>
                    <div className="flex flex-wrap gap-1.5">
                      {domain.expiry.domainStatus.map((status, i) => (
                        <span key={i} className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium">
                          {status}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">No registration/expiry information available.</p>
              </div>
            )}
          </section>

          {/* Technology Stack */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Code className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">Technology Stack</h3>
            </div>
            {domain.techStack && domain.techStack.confidence !== 'low' ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-emerald-500/10">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded ${getTechStackColor(domain.techStack.cms || domain.techStack.ecommerce)}`}>
                      {domain.techStack.cms || domain.techStack.ecommerce || domain.techStack.framework || 'Detected'}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Confidence: {domain.techStack.confidence}
                    </span>
                  </div>
                  {domain.techStack.adminUrl && (
                    <a
                      href={`https://${domain.url}${domain.techStack.adminUrl}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      Open Admin
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {domain.techStack.cms && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">CMS</p>
                      <p className="font-medium text-zinc-200 flex items-center gap-2">
                        <span>{domain.techStack.cms}</span>
                      </p>
                    </div>
                  )}
                  {domain.techStack.ecommerce && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1 flex items-center gap-1">
                        <ShoppingCart size={12} /> Ecommerce
                      </p>
                      <p className="font-medium text-zinc-200">{domain.techStack.ecommerce}</p>
                    </div>
                  )}
                  {domain.techStack.framework && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1 flex items-center gap-1">
                        <Code size={12} /> Framework
                      </p>
                      <p className="font-medium text-zinc-200">{domain.techStack.framework}</p>
                    </div>
                  )}
                  {domain.techStack.server && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1 flex items-center gap-1">
                        <Server size={12} /> Server
                      </p>
                      <p className="font-medium text-zinc-200">{domain.techStack.server}</p>
                    </div>
                  )}
                  {domain.techStack.analytics && domain.techStack.analytics.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1 flex items-center gap-1">
                        <BarChart3 size={12} /> Analytics
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {domain.techStack.analytics.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-700 dark:text-slate-300">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {domain.techStack.javascriptLibraries && domain.techStack.javascriptLibraries.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1 flex items-center gap-1">
                        <Code size={12} /> JavaScript
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {domain.techStack.javascriptLibraries.map((lib, i) => (
                          <span key={i} className="px-2 py-0.5 bg-emerald-500/10 rounded text-xs text-emerald-300">
                            {lib}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">Technology stack detection unavailable. Click "Check" to analyze.</p>
              </div>
            )}
          </section>

          {/* DNS / Nameservers */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Server className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">DNS Records & Nameservers</h3>
            </div>
            {domain.dns || (domain.expiry && domain.expiry.nameServers) ? (
              <div className="space-y-4">
                {/* Nameservers - from WHOIS */}
                {(domain.expiry?.nameServers && domain.expiry.nameServers.length > 0) && (
                  <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Info size={14} className="text-emerald-400" />
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Nameservers (from WHOIS)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {domain.expiry.nameServers.map((ns, i) => (
                        <span key={i} className="px-3 py-1.5 bg-zinc-900 border border-emerald-500/20 rounded-lg text-xs font-mono text-emerald-300 shadow-sm">
                          {ns}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Nameservers - from DNS lookup */}
                {domain.dns && (
                  <>
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">Nameservers (DNS Lookup)</p>
                      <div className="flex flex-wrap gap-2">
                        {domain.dns.ns && domain.dns.ns.length > 0 ? (
                          domain.dns.ns.map((ns, i) => (
                            <span key={i} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-emerald-400 shadow-sm">
                              {ns}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500 italic">No NS records found</span>
                        )}
                      </div>
                    </div>

                    {/* A Records */}
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">A Records (IPs)</p>
                      <div className="flex flex-wrap gap-2">
                        {domain.dns.a && domain.dns.a.length > 0 ? (
                          domain.dns.a.map((ip, i) => (
                            <span key={i} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-300 shadow-sm">
                              {ip}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500 italic">No A records found</span>
                        )}
                      </div>
                    </div>

                    {/* AAAA Records */}
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">AAAA Records (IPv6)</p>
                      <div className="flex flex-wrap gap-2">
                        {domain.dns.aaaa && domain.dns.aaaa.length > 0 ? (
                          domain.dns.aaaa.map((ip, i) => (
                            <span key={i} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-slate-300 shadow-sm">
                              {ip}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500 italic">No AAAA records found</span>
                        )}
                      </div>
                    </div>

                    {/* MX Records */}
                    <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">Mail Servers (MX)</p>
                      <div className="space-y-2">
                        {domain.dns.mx && domain.dns.mx.length > 0 ? (
                          domain.dns.mx.map((mx, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs shadow-sm">
                              <span className="font-mono text-slate-700 dark:text-slate-300">{mx.exchange}</span>
                              <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold text-[10px]">PRIO {mx.priority}</span>
                            </div>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-500 italic">No MX records found</span>
                        )}
                      </div>
                    </div>

                    {/* CAA Records */}
                    {domain.dns.caa && domain.dns.caa.length > 0 && (
                      <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">CAA Records</p>
                        <div className="space-y-1.5">
                          {domain.dns.caa.map((c, i) => (
                            <div key={i} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-mono text-zinc-400 break-all">
                              {c.raw}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* SOA */}
                    {domain.dns.soa && (
                      <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">SOA</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-zinc-500">Primary NS</span><p className="font-mono text-zinc-300">{domain.dns.soa.nsname}</p></div>
                          <div><span className="text-zinc-500">Hostmaster</span><p className="font-mono text-zinc-300">{domain.dns.soa.hostmaster}</p></div>
                          <div><span className="text-zinc-500">Serial</span><p className="font-mono text-zinc-300">{domain.dns.soa.serial}</p></div>
                          <div><span className="text-zinc-500">TTL / Refresh</span><p className="font-mono text-zinc-300">{domain.dns.soa.minttl} / {domain.dns.soa.refresh}</p></div>
                        </div>
                      </div>
                    )}

                    {/* CNAME Records */}
                    {domain.dns.cname && domain.dns.cname.length > 0 && (
                      <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">CNAME Records</p>
                        <div className="flex flex-wrap gap-2">
                          {domain.dns.cname.map((c, i) => (
                            <span key={i} className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 shadow-sm">{c}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* TXT Records */}
                    {domain.dns.txt && domain.dns.txt.length > 0 && (
                      <div className="bg-zinc-800/50 p-4 rounded-xl border border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-widest">TXT Records</p>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {domain.dns.txt.map((txtGroup, i) => (
                            <div key={i} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[10px] font-mono text-zinc-400 break-all">
                              {txtGroup.join('')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">DNS lookup hasn't been performed yet.</p>
              </div>
            )}
          </section>

          {/* Email Authentication */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Mail className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">Email Authentication</h3>
              {domain.emailAuth && (
                <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded border ${healthGradeColor(domain.emailAuth.grade)}`}>
                  {domain.emailAuth.grade}
                </span>
              )}
            </div>
            {domain.emailAuth ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">SPF</span>
                      <span className={domain.emailAuth.spf.present ? 'text-emerald-400 text-xs font-bold' : 'text-rose-400 text-xs font-bold'}>
                        {domain.emailAuth.spf.present ? 'Present' : 'Missing'}
                      </span>
                    </div>
                    {domain.emailAuth.spf.detail && (
                      <p className="text-[10px] font-mono text-zinc-400 break-all line-clamp-3">{domain.emailAuth.spf.detail}</p>
                    )}
                  </div>
                  <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">DKIM</span>
                      <span className={domain.emailAuth.dkim.present ? 'text-emerald-400 text-xs font-bold' : 'text-rose-400 text-xs font-bold'}>
                        {domain.emailAuth.dkim.present ? 'Present' : 'Missing'}
                      </span>
                    </div>
                    {domain.emailAuth.dkim.detail && (
                      <p className="text-[10px] font-mono text-zinc-400 break-all line-clamp-3">{domain.emailAuth.dkim.detail}</p>
                    )}
                    {domain.emailAuth.dkim.selectors && domain.emailAuth.dkim.selectors.length > 0 && (
                      <p className="text-[10px] text-zinc-500 mt-1">selectors: {domain.emailAuth.dkim.selectors.join(', ')}</p>
                    )}
                  </div>
                  <div className="bg-zinc-800/50 p-3 rounded-xl border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase">DMARC</span>
                      <span className={domain.emailAuth.dmarc.present ? 'text-emerald-400 text-xs font-bold' : 'text-rose-400 text-xs font-bold'}>
                        {domain.emailAuth.dmarc.present ? 'Present' : 'Missing'}
                      </span>
                    </div>
                    {domain.emailAuth.dmarc.detail && (
                      <p className="text-[10px] font-mono text-zinc-400 break-all line-clamp-3">{domain.emailAuth.dmarc.detail}</p>
                    )}
                    {domain.emailAuth.dmarc.policy && (
                      <p className="text-[10px] text-zinc-500 mt-1">policy: {domain.emailAuth.dmarc.policy}</p>
                    )}
                  </div>
                </div>
                {domain.emailAuth.issues.length > 0 && (
                  <ul className="space-y-1">
                    {domain.emailAuth.issues.map((issue, i) => (
                      <li key={i} className="text-xs text-amber-400/90 flex gap-2">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">Email authentication check hasn't run yet.</p>
              </div>
            )}
          </section>

          {/* Security Headers */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Lock className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">Security Headers</h3>
              {domain.securityHeaders && (
                <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded border ${healthGradeColor(domain.securityHeaders.grade)}`}>
                  {domain.securityHeaders.grade}
                </span>
              )}
            </div>
            {domain.securityHeaders ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center text-sm">
                  <span className="text-zinc-400">Score</span>
                  <span className="font-mono text-zinc-200">{domain.securityHeaders.score}/{domain.securityHeaders.maxScore}</span>
                </div>
                <div className="divide-y divide-zinc-800">
                  {domain.securityHeaders.headers.map((h) => (
                    <div key={h.name} className="px-4 py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-200">{h.name}</p>
                        {h.value && <p className="font-mono text-zinc-500 break-all mt-0.5 line-clamp-2">{h.value}</p>}
                      </div>
                      <span className={h.present ? 'text-emerald-400 font-bold shrink-0' : 'text-rose-400 font-bold shrink-0'}>
                        {h.present ? `+${h.score}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
                {domain.securityHeaders.issues.length > 0 && (
                  <ul className="px-4 py-3 space-y-1 border-t border-zinc-800">
                    {domain.securityHeaders.issues.map((issue, i) => (
                      <li key={i} className="text-xs text-amber-400/90 flex gap-2">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">Security headers check hasn't run yet.</p>
              </div>
            )}
          </section>

          {/* Google Business Profile (GMB) */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">Google Business Profile</h3>
              {domain.gmb && domain.gmb.status !== GmbStatus.Unknown && (
                <span className={`text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded border ${gmbColor(domain.gmb.status)}`}>
                  {gmbLabel(domain.gmb.status)}
                </span>
              )}
            </div>

            {domain.gmb && (domain.gmb.status === GmbStatus.Operational || domain.gmb.status === GmbStatus.Closed) ? (
              <div className="space-y-3 mb-4">
                <p className="text-sm font-semibold text-white">{domain.gmb.name || domain.url}</p>
                <div className="flex flex-wrap gap-2">
                  {typeof domain.gmb.rating === 'number' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-800/60 border border-zinc-800 rounded-lg text-xs text-amber-300">
                      <Star size={12} className="fill-current" /> {domain.gmb.rating.toFixed(1)}
                      <span className="text-zinc-500">({domain.gmb.reviewCount ?? 0} reviews)</span>
                    </span>
                  )}
                  {domain.gmb.openNow !== undefined && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-800/60 border border-zinc-800 rounded-lg text-xs text-zinc-300">
                      <Clock size={12} /> {domain.gmb.openNow ? 'Open now' : 'Closed now'}
                    </span>
                  )}
                  {domain.gmb.phone && (
                    <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-800/60 border border-zinc-800 rounded-lg text-xs text-zinc-300">
                      <Phone size={12} /> {domain.gmb.phone}
                    </span>
                  )}
                </div>
                {domain.gmb.address && <p className="text-xs text-zinc-400">{domain.gmb.address}</p>}
                {domain.gmb.mapsUrl && (
                  <a href={domain.gmb.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
                    View on Google Maps <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ) : domain.gmb?.error ? (
              <p className="text-xs text-amber-400 mb-4">{domain.gmb.error}</p>
            ) : (
              <p className="text-sm text-zinc-500 mb-4">No GMB data yet. Set a Place ID and run a check.</p>
            )}

            <div className="bg-zinc-800/30 p-4 rounded-xl border border-dashed border-zinc-800">
              <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-widest block">Google Place ID</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={placeIdInput}
                  onChange={(e) => setPlaceIdInput(e.target.value)}
                  placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
                  className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/50"
                />
                <button
                  onClick={() => {
                    const trimmed = placeIdInput.trim();
                    onSetGmbPlaceId?.(domain.id, trimmed);
                    if (trimmed) onCheckGmb?.(domain.id, trimmed);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-tight hover:bg-emerald-500/20 transition-colors"
                >
                  <RefreshCw size={12} /> Save & Check
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">
                Find a Place ID at the Google Place ID Finder. Requires GOOGLE_PLACES_API_KEY on the server.
              </p>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-zinc-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Link2 size={14} />
            <span>External tools:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-zinc-900 border border-zinc-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm shadow-sm"
            >
              Close
            </button>
            <a
              href={`https://whois.com/whois/${domain.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all text-sm shadow-md flex items-center gap-1.5"
              title="Check WHOIS registration information"
            >
              WHOIS
              <ExternalLink size={14} />
            </a>
            <a
              href={`https://dnslytics.com/domain/${domain.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl transition-all text-sm shadow-md flex items-center gap-1.5 dark:bg-slate-600 dark:hover:bg-slate-700"
              title="View DNS records and analysis"
            >
              DNS
              <ExternalLink size={14} />
            </a>
            <a
              href={`https://www.sslshopper.com/ssl-checker.html#hostname=${domain.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all text-sm shadow-md flex items-center gap-1.5"
              title="Verify SSL certificate installation"
            >
              SSL
              <ExternalLink size={14} />
            </a>
            <a
              href={`https://transparencyreport.google.com/safe-browsing/search?url=${domain.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all text-sm shadow-md flex items-center gap-1.5"
              title="Check Google Safe Browsing status"
            >
              Safety
              <ExternalLink size={14} />
            </a>
            <a
              href={`https://site-explorer.com/?q=${domain.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all text-sm shadow-md flex items-center gap-1.5"
              title="View site explorer and backlinks"
            >
              Explorer
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
