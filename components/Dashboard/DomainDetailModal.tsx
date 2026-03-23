import React, { useEffect } from 'react';
import { X, Shield, Calendar, Globe, Server, Hash, Activity, Clock, ExternalLink, Info, CheckCircle, AlertCircle, Link2, Code, ShoppingCart, BarChart3 } from 'lucide-react';
import { Domain, DomainStatus, SSLStatus } from '../../types';
import { getSSLStatusColor, getSSLStatusLabel } from '../../services/sslService';
import { getExpiryStatusColor, getExpiryStatusLabel } from '../../services/expiryService';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { getTechStackColor } from '../../components/TechStackBadge';

interface DomainDetailModalProps {
  domain: Domain;
  onClose: () => void;
}

export const DomainDetailModal: React.FC<DomainDetailModalProps> = ({ domain, onClose }) => {
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
        className="bg-zinc-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
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
                Domain status: {domain.status === DomainStatus.Alive ? 'Online' : 'Offline'}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${domain.status === DomainStatus.Alive ? 'bg-emerald-500' : 'bg-rose-500'}`} aria-hidden="true" />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  {domain.status} {domain.statusCode ? `(${domain.statusCode})` : ''}
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
                <Globe size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Group</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{domain.groupId || 'None'}</p>
            </div>
          </div>

          {/* SSL Information */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-emerald-400" size={18} />
              <h3 className="font-bold text-white">SSL Certificate</h3>
            </div>
            {domain.ssl && domain.ssl.status !== SSLStatus.Unknown ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <div className={`px-4 py-3 border-b border-zinc-800 flex justify-between items-center ${getSSLStatusColor(domain.ssl.status)}`}>
                  <span className="text-xs font-bold uppercase tracking-wider">{getSSLStatusLabel(domain.ssl.status)}</span>
                  <span className="text-xs font-bold">{domain.ssl.daysUntilExpiry} days remaining</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Issuer</p>
                    <p className="font-medium text-zinc-200">{domain.ssl.issuer || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Valid To</p>
                    <p className="font-medium text-zinc-200">
                      {domain.ssl.validTo ? new Date(domain.ssl.validTo).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>
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
                <div className={`px-4 py-3 border-b border-zinc-800 flex justify-between items-center ${getExpiryStatusColor(domain.expiry.status)}`}>
                  <span className="text-xs font-bold uppercase tracking-wider">{getExpiryStatusLabel(domain.expiry.status)}</span>
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
                <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/20">
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
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
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
                          <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 rounded text-xs text-emerald-300">
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
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Info size={14} className="text-emerald-400" />
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Nameservers (from WHOIS)</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {domain.expiry.nameServers.map((ns, i) => (
                        <span key={i} className="px-3 py-1.5 bg-zinc-900 border border-indigo-200 dark:border-indigo-700 rounded-lg text-xs font-mono text-emerald-300 shadow-sm">
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
                  </>
                )}
              </div>
            ) : (
              <div className="text-center py-6 bg-zinc-800/30 rounded-xl border border-dashed border-zinc-800">
                <p className="text-sm text-zinc-500">DNS lookup hasn't been performed yet.</p>
              </div>
            )}
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
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all text-sm shadow-md flex items-center gap-1.5"
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
