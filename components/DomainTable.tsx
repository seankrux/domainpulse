import React, { useState, useRef, useEffect } from 'react';
import { Domain, DomainStatus, SSLStatus, DomainGroup, SSLInfo, DomainExpiry /* TechStackInfo */ } from '../types';
import { Trash2, RefreshCw, ExternalLink, Edit2, Check, X, Search, History, Shield, Calendar, LayoutDashboard, Plus, Copy, CheckCheck } from 'lucide-react';
import { getSSLStatusColor, getSSLStatusLabel } from '../services/sslService';
import { getExpiryStatusColor, getExpiryStatusLabel } from '../services/expiryService';
import { TechStackBadge } from './TechStackBadge';
import { logger } from '../utils/logger';

interface DomainTableProps {
  domains: Domain[];
  selectedIds: Set<string>;
  isFiltered?: boolean;
  groups?: DomainGroup[];
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, newUrl: string) => void;
  onCheck: (id: string) => void;
  onEditTags?: (id: string, tags: string[]) => void;
  onEditGroup?: (id: string, groupId?: string) => void;
  onViewHistory?: (domain: Domain) => void;
  onViewDetails?: (domain: Domain) => void;
}

const Skeleton = ({ className = "w-16" }: { className?: string }) => (
  <div className={`h-4 bg-zinc-800 rounded animate-pulse ${className}`} />
);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LoadingSkeletonRow = () => (
  <tr className="animate-pulse">
    <td className="p-4 text-center"><div className="w-4 h-4 bg-zinc-800 rounded mx-auto" /></td>
    <td className="p-4 pl-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-zinc-800" />
        <div className="space-y-2">
          <Skeleton className="w-32 h-4" />
          <Skeleton className="w-20 h-3" />
        </div>
      </div>
    </td>
    <td className="p-4"><Skeleton className="w-20 h-6" /></td>
    <td className="p-4"><Skeleton className="w-16 h-6" /></td>
    <td className="p-4"><Skeleton className="w-16 h-6" /></td>
    <td className="p-4 hidden xl:table-cell"><Skeleton className="w-24 h-4" /></td>
    <td className="p-4"><Skeleton className="w-12 h-4" /></td>
    <td className="p-4 hidden md:table-cell"><Skeleton className="w-16 h-4" /></td>
    <td className="p-4 hidden lg:table-cell"><Skeleton className="w-20 h-4" /></td>
    <td className="p-4 text-right"><Skeleton className="w-16 h-8" /></td>
  </tr>
);

const Favicon = ({ url }: { url: string }) => {
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${url}&sz=128`;

  if (status === 'error') {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 font-bold text-xs border border-emerald-500/20 flex-shrink-0">
        {url.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      {status === 'loading' && (
        <div className="absolute inset-0 rounded-full bg-zinc-800 animate-pulse" />
      )}
      <img
        src={faviconUrl}
        alt=""
        className={`w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 object-contain p-0.5 transition-opacity duration-300 ${status === 'success' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setStatus('success')}
        onError={() => setStatus('error')}
      />
    </div>
  );
};

const StatusBadge: React.FC<{ status: DomainStatus; statusCode?: number }> = ({ status, statusCode }) => {
  const configs = {
    [DomainStatus.Alive]: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500 status-dot-green', border: 'border-emerald-500/20' },
    [DomainStatus.Down]: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500 status-dot-red', border: 'border-red-500/20' },
    [DomainStatus.Checking]: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500', border: 'border-blue-500/20' },
    [DomainStatus.Unknown]: { bg: 'bg-zinc-800', text: 'text-zinc-400', dot: 'bg-zinc-500', border: 'border-zinc-700' },
    [DomainStatus.Error]: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500', border: 'border-amber-500/20' },
  };

  const config = configs[status];

  let displayText = status === DomainStatus.Checking ? 'Checking...' : (status.charAt(0) + status.slice(1).toLowerCase());

  if (statusCode && status !== DomainStatus.Checking && status !== DomainStatus.Unknown) {
    displayText = `${statusCode}`;
    if (statusCode === 200) displayText = '200 OK';
  }

  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold ${config.bg} ${config.text} border ${config.border} shadow-sm transition-all hover:shadow-md whitespace-nowrap`}>
      <span className={`w-2 h-2 rounded-full ${config.dot} ${status === DomainStatus.Checking ? 'animate-pulse' : ''} shadow-glow`} />
      {displayText}
    </span>
  );
};

const SSLBadge: React.FC<{ ssl?: SSLInfo, onClick?: () => void }> = ({ ssl, onClick }) => {
  if (!ssl || ssl.status === SSLStatus.Unknown) {
    return (
      <button onClick={onClick} className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-emerald-400 transition-colors">
        -
      </button>
    );
  }

  const colorClass = getSSLStatusColor(ssl.status);
  const label = getSSLStatusLabel(ssl.status);
  
  let displayLabel = label;
  if (ssl.daysUntilExpiry !== undefined && ssl.status === SSLStatus.Valid) {
    displayLabel = `${ssl.daysUntilExpiry}d`;
  } else if (ssl.status === SSLStatus.Expiring) {
    displayLabel = `${ssl.daysUntilExpiry}d`;
  }

  return (
    <button 
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 ${colorClass}`} 
      title={ssl.issuer || label}
    >
      <Shield size={10} strokeWidth={2.5} />
      {displayLabel}
    </button>
  );
};

const GroupBadge: React.FC<{ group?: DomainGroup }> = ({ group }) => {
  if (!group) return null;
  
  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight shadow-sm"
      style={{ backgroundColor: `${group.color}20`, color: group.color, border: `1px solid ${group.color}30` }}
    >
      {group.name}
    </span>
  );
};

const ExpiryBadge: React.FC<{ expiry?: DomainExpiry, onClick?: () => void }> = ({ expiry, onClick }) => {
  if (!expiry || expiry.status === 'unknown') {
    return (
      <button onClick={onClick} className="text-zinc-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-emerald-400 transition-colors">
        -
      </button>
    );
  }

  const colorClass = getExpiryStatusColor(expiry.status);
  const label = getExpiryStatusLabel(expiry.status);
  
  let displayLabel = label;
  if (expiry.daysUntilExpiry !== undefined && expiry.status === 'active') {
    displayLabel = `${expiry.daysUntilExpiry}d`;
  } else if (expiry.status === 'expiring') {
    displayLabel = `${expiry.daysUntilExpiry}d`;
  }

  return (
    <button 
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight border shadow-sm transition-all hover:shadow-md hover:scale-105 ${colorClass}`} 
      title={expiry.registrar || label}
    >
      <Calendar size={10} strokeWidth={2.5} />
      {displayLabel}
    </button>
  );
};

// History sparkline component
const HistorySparkline: React.FC<{ history: { status: DomainStatus; latency: number }[] }> = ({ history }) => {
  if (history.length === 0) return <span className="text-zinc-700">-</span>;
  
  const recentHistory = history.slice(-10);
  
  return (
    <div className="flex items-center gap-0.5" title={`${history.length} checks recorded`}>
      {recentHistory.map((record, i) => {
        const color = record.status === DomainStatus.Alive 
          ? 'bg-emerald-500' 
          : record.status === DomainStatus.Down 
            ? 'bg-red-500'
            : 'bg-zinc-700';
        const height = record.status === DomainStatus.Alive 
          ? Math.max(4, Math.min(12, 12 - (record.latency / 100))) 
          : 4;
        return (
          <div
            key={i}
            className={`w-1 rounded-full ${color} transition-all`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

export const DomainTable: React.FC<DomainTableProps> = ({
    domains,
    selectedIds,
    isFiltered = false,
    groups = [],
    onToggleSelect,
    onToggleAll,
    onRemove,
    onUpdate,
    onCheck,
    onEditTags,
    onEditGroup,
    onViewHistory,
    onViewDetails
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTagsId, setEditingTagsId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newTag, setNewTag] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const startEdit = (domain: Domain) => {
    setEditingId(domain.id);
    setEditValue(domain.url);
  };

  const saveEdit = (id: string) => {
    if (editValue.trim()) {
      onUpdate(id, editValue.trim());
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const addTag = (id: string, currentTags: string[]) => {
    if (!newTag.trim() || !onEditTags) return;
    if (!currentTags.includes(newTag.trim())) {
      onEditTags(id, [...currentTags, newTag.trim()]);
    }
    setNewTag('');
  };

  const removeTag = (id: string, currentTags: string[], tag: string) => {
    if (!onEditTags) return;
    onEditTags(id, currentTags.filter(t => t !== tag));
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      logger.error('Failed to copy to clipboard:', error);
    }
  };

  const formatRelativeTime = (date?: Date) => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const allSelected = domains.length > 0 && domains.every(d => selectedIds.has(d.id));
  const someSelected = domains.some(d => selectedIds.has(d.id));
  const isIndeterminate = someSelected && !allSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
        headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  if (domains.length === 0) {
    if (isFiltered) {
        return (
            <div className="text-center py-16 glass-card rounded-2xl flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-3 text-zinc-500">
                    <Search size={24} />
                </div>
                <h3 className="text-white font-medium text-lg">No matching domains</h3>
                <p className="text-zinc-400 mt-1 max-w-sm mx-auto text-sm">Try adjusting your filters to find what you're looking for.</p>
            </div>
        );
    }

    return (
      <div className="text-center py-24 glass-card rounded-3xl border-dashed flex flex-col items-center justify-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
        <div className="w-20 h-20 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 text-emerald-400 transform group-hover:scale-110 transition-transform duration-500 shadow-glow-emerald border border-emerald-500/20">
            <LayoutDashboard size={32} />
        </div>
        <h3 className="text-white font-display font-bold text-xl mb-2">Ready to monitor your domains?</h3>
        <p className="text-zinc-400 max-w-sm mx-auto text-sm mb-8 leading-relaxed">
            Track uptime, latency, SSL status, and domain expiry in one powerful dashboard. Start by adding your first domain above.
        </p>
        <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400`}>
                        {['G', 'A', 'M'][i-1]}
                    </div>
                ))}
            </div>
            <p className="text-xs text-zinc-500 font-medium">Trusted by teams worldwide</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl overflow-hidden" role="region" aria-label="Domains table">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0" role="grid" aria-rowcount={domains.length + 1}>
          <thead>
            <tr className="bg-zinc-900/80 border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider font-semibold" role="row">
              <th className="p-4 w-12 text-center" role="columnheader" aria-label="Select">
                <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer transition-all bg-zinc-800"
                    checked={allSelected}
                    onChange={onToggleAll}
                    aria-label="Select all domains"
                />
              </th>
              <th className="p-4 pl-2" role="columnheader" scope="col">Domain</th>
              <th className="p-4" role="columnheader" scope="col">Status</th>
              <th className="p-4" role="columnheader" scope="col">Tech Stack</th>
              <th className="p-4" role="columnheader" scope="col">SSL</th>
              <th className="p-4" role="columnheader" scope="col">Expiry</th>
              <th className="p-4 hidden xl:table-cell" role="columnheader" scope="col">Nameservers</th>
              <th className="p-4" role="columnheader" scope="col">Latency</th>
              <th className="p-4 hidden md:table-cell" role="columnheader" scope="col">Last Checked</th>
              <th className="p-4 hidden lg:table-cell" role="columnheader" scope="col">History</th>
              <th className="p-4 text-right" role="columnheader" scope="col">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {domains.map((domain) => {
              const isChecking = domain.status === DomainStatus.Checking;
              const isSelected = selectedIds.has(domain.id);

              return (
                <tr
                  key={domain.id}
                  id={`domain-${domain.id}`}
                  role="row"
                  aria-rowindex={domains.indexOf(domain) + 2}
                  aria-selected={isSelected}
                  className={`group table-row-hover transition-all duration-300 ${isSelected ? 'bg-emerald-500/5' : 'hover:bg-zinc-800/50'}`}
                >
                  <td className="p-4 text-center align-middle" role="gridcell">
                     <input
                        type="checkbox"
                        className="rounded border-zinc-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer transition-all opacity-100 md:opacity-30 md:group-hover:opacity-100 checked:opacity-100 bg-zinc-800"
                        checked={isSelected}
                        onChange={() => onToggleSelect(domain.id)}
                        aria-label={`Select ${domain.url}`}
                    />
                  </td>
                  <td className="p-4 pl-2 align-middle">
                    {editingId === domain.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="border border-emerald-500/30 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-full max-w-[240px] shadow-sm bg-zinc-900 text-white"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(domain.id);
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                        <button onClick={() => saveEdit(domain.id)} className="p-1.5 rounded-md bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"><Check size={14} /></button>
                        <button onClick={cancelEdit} className="p-1.5 rounded-md bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <Favicon url={domain.url} />
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span
                                  onClick={() => onViewDetails?.(domain)}
                                  data-testid={`domain-link-${domain.url}`}
                                  className="font-semibold text-zinc-100 text-sm truncate max-w-[150px] sm:max-w-[200px] md:max-w-[300px] cursor-pointer hover:text-emerald-400 transition-colors flex items-center gap-2 group/domain"
                                >
                                  {domain.url}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void copyToClipboard(domain.url, domain.id);
                                    }}
                                    className="opacity-0 group-hover/domain:opacity-100 p-0.5 hover:bg-zinc-800 rounded transition-all"
                                    title="Copy domain to clipboard"
                                    aria-label={`Copy ${domain.url} to clipboard`}
                                  >
                                    {copiedId === domain.id ? (
                                      <CheckCheck size={12} className="text-emerald-500" />
                                    ) : (
                                      <Copy size={12} className="text-slate-400" />
                                    )}
                                  </button>
                                </span>
                                <a
                                href={`https://${domain.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-zinc-600 hover:text-emerald-400 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                >
                                <ExternalLink size={12} />
                                </a>
                            </div>
                            <div className="flex items-center gap-2 relative">
                              <button 
                                onClick={() => setEditingGroupId(domain.id)}
                                className="group/badge"
                                title="Change Group"
                              >
                                {domain.groupId ? (
                                  <GroupBadge group={groups?.find(g => g.id === domain.groupId)} />
                                ) : (
                                  <span className="text-[10px] uppercase font-bold text-zinc-600 border border-dashed border-zinc-700 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Group</span>
                                )}
                              </button>
                              
                              {editingGroupId === domain.id && (
                                <div className="absolute top-full left-0 mt-1 z-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 min-w-[160px] animate-in fade-in zoom-in-95 origin-top-left">
                                  <div className="flex items-center justify-between mb-2 px-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Group</span>
                                    <button onClick={() => setEditingGroupId(null)}><X size={12} className="text-zinc-500 hover:text-zinc-300" /></button>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      onEditGroup?.(domain.id, undefined);
                                      setEditingGroupId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded-md transition-colors"
                                  >
                                    No Group
                                  </button>
                                  {groups.map(group => (
                                    <button
                                      key={group.id}
                                      onClick={() => {
                                        onEditGroup?.(domain.id, group.id);
                                        setEditingGroupId(null);
                                      }}
                                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-zinc-800 rounded-md transition-colors flex items-center gap-2"
                                    >
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }}></div>
                                      {group.name}
                                    </button>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-1 flex-wrap relative">
                                {domain.tags?.map((tag, i) => (
                                  <span 
                                    key={i} 
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 group/tag hover:bg-red-500/10 hover:text-red-400 cursor-pointer transition-colors"
                                    onClick={() => removeTag(domain.id, domain.tags, tag)}
                                    title="Click to remove"
                                  >
                                    {tag}
                                    <X size={8} className="opacity-0 group-hover/tag:opacity-100" />
                                  </span>
                                ))}
                                <button 
                                  onClick={() => setEditingTagsId(domain.id)}
                                  className="text-zinc-600 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                  title="Add Tag"
                                >
                                  <Plus size={10} />
                                </button>

                                {editingTagsId === domain.id && (
                                  <div className="absolute top-full left-0 mt-1 z-40 bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 min-w-[140px] animate-in fade-in zoom-in-95 origin-top-left flex gap-1">
                                    <input
                                      autoFocus
                                      type="text"
                                      placeholder="New tag..."
                                      value={newTag}
                                      onChange={(e) => setNewTag(e.target.value)}
                                      className="bg-transparent border-none outline-none text-xs w-full text-white"
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          addTag(domain.id, domain.tags);
                                          setEditingTagsId(null);
                                        }
                                        if (e.key === 'Escape') setEditingTagsId(null);
                                      }}
                                    />
                                    <button onClick={() => {
                                      addTag(domain.id, domain.tags);
                                      setEditingTagsId(null);
                                    }} className="text-emerald-400"><Check size={14} /></button>
                                  </div>
                                )}
                              </div>
                            </div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-4 align-middle">
                    <StatusBadge status={domain.status} statusCode={domain.statusCode} />
                  </td>
                  <td className="p-4 align-middle">
                    <TechStackBadge 
                      techStack={domain.techStack} 
                      domain={domain.url}
                      onClick={() => onViewDetails?.(domain)}
                    />
                  </td>
                  <td className="p-4 align-middle">
                    <SSLBadge ssl={domain.ssl} onClick={() => onViewDetails?.(domain)} />
                  </td>
                  <td className="p-4 align-middle">
                    <ExpiryBadge expiry={domain.expiry} onClick={() => onViewDetails?.(domain)} />
                  </td>
                  <td className="p-4 align-middle hidden xl:table-cell">
                    {isChecking ? (
                      <Skeleton className="w-24 h-4" />
                    ) : (
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {(domain.expiry?.nameServers && domain.expiry.nameServers.length > 0) ? (
                          domain.expiry.nameServers.slice(0, 2).map((ns, i) => (
                            <span key={i} className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-mono text-emerald-400 truncate max-w-[100px]">
                              {ns}
                            </span>
                          ))
                        ) : domain.dns?.ns && domain.dns.ns.length > 0 ? (
                          domain.dns.ns.slice(0, 2).map((ns, i) => (
                            <span key={i} className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-[9px] font-mono text-zinc-400 truncate max-w-[100px]">
                              {ns}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-600 italic">-</span>
                        )}
                        {((domain.expiry?.nameServers?.length || domain.dns?.ns?.length || 0) > 2) && (
                          <span className="px-2 py-0.5 text-[9px] text-slate-400">+{((domain.expiry?.nameServers?.length || 0) + (domain.dns?.ns?.length || 0)) - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4 align-middle text-sm text-zinc-300 font-mono">
                    {isChecking ? (
                        <Skeleton className="w-12 h-4" />
                    ) : (
                        domain.latency ? <span className={domain.latency > 500 ? 'text-amber-400' : 'text-zinc-300'}>{domain.latency}ms</span> : <span className="text-zinc-700">-</span>
                    )}
                  </td>
                  <td className="p-4 align-middle text-sm text-zinc-400 hidden md:table-cell">
                    {isChecking ? (
                        <Skeleton className="w-20 h-4" />
                    ) : (
                        domain.lastChecked ? (
                          <span className="flex items-center gap-2">
                            {formatRelativeTime(domain.lastChecked)}
                            <span className="text-xs text-zinc-600">({domain.lastChecked.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>
                          </span>
                        ) : <span className="text-zinc-700">Never</span>
                    )}
                  </td>
                  <td className="p-4 align-middle hidden lg:table-cell">
                    <HistorySparkline history={domain.history} />
                  </td>
                  <td className="p-4 align-middle text-right" role="gridcell">
                    <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewHistory && onViewHistory(domain)}
                        className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        title="View history"
                        aria-label={`View history for ${domain.url}`}
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => onCheck(domain.id)}
                        disabled={isChecking}
                        className="p-1.5 text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        title="Check status"
                        aria-label={`Check status for ${domain.url}`}
                        aria-busy={isChecking}
                      >
                        <RefreshCw size={16} className={isChecking ? "animate-spin" : ""} />
                      </button>
                      <button
                        onClick={() => startEdit(domain)}
                        className="p-1.5 text-zinc-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                        title="Edit domain"
                        aria-label={`Edit domain ${domain.url}`}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onRemove(domain.id)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50"
                        title="Remove"
                        aria-label={`Remove ${domain.url}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};