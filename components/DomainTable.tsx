import React, { useState, useRef, useEffect } from 'react';
import { Domain, DomainStatus, SSLStatus, DomainGroup, SSLInfo, DomainExpiry, TechStackInfo } from '../types';
import { Trash2, RefreshCw, ExternalLink, Edit2, Check, X, Search, History, Shield, Calendar, LayoutDashboard, Plus, Copy, CheckCheck } from 'lucide-react';
import { getSSLStatusColor, getSSLStatusLabel } from '../services/sslService';
import { getExpiryStatusColor, getExpiryStatusLabel } from '../services/expiryService';
import { TechStackBadge } from './TechStackBadge';

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
  <div className={`h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${className}`} />
);

const LoadingSkeletonRow = () => (
  <tr className="animate-pulse">
    <td className="p-4 text-center"><div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded mx-auto" /></td>
    <td className="p-4 pl-2">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" />
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
      <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-100 dark:border-indigo-800 flex-shrink-0">
        {url.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      {status === 'loading' && (
        <div className="absolute inset-0 rounded-full bg-slate-100 dark:bg-slate-700 animate-pulse" />
      )}
      <img
        src={faviconUrl}
        alt=""
        className={`w-8 h-8 rounded-full bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 object-contain p-0.5 transition-opacity duration-300 ${status === 'success' ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setStatus('success')}
        onError={() => setStatus('error')}
      />
    </div>
  );
};

const StatusBadge: React.FC<{ status: DomainStatus; statusCode?: number }> = ({ status, statusCode }) => {
  const configs = {
    [DomainStatus.Alive]: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-100 dark:border-emerald-800/50' },
    [DomainStatus.Down]: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500', border: 'border-rose-100 dark:border-rose-800/50' },
    [DomainStatus.Checking]: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500', border: 'border-indigo-100 dark:border-indigo-800/50' },
    [DomainStatus.Unknown]: { bg: 'bg-slate-50 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400', border: 'border-slate-200 dark:border-slate-700' },
    [DomainStatus.Error]: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500', border: 'border-amber-100 dark:border-amber-800/50' },
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
      <button onClick={onClick} className="text-slate-300 dark:text-slate-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-indigo-500 transition-colors">
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
      <button onClick={onClick} className="text-slate-300 dark:text-slate-700 text-[10px] font-bold uppercase tracking-widest pl-2 hover:text-indigo-500 transition-colors">
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
  if (history.length === 0) return <span className="text-slate-300 dark:text-slate-600">-</span>;
  
  const recentHistory = history.slice(-10);
  
  return (
    <div className="flex items-center gap-0.5" title={`${history.length} checks recorded`}>
      {recentHistory.map((record, i) => {
        const color = record.status === DomainStatus.Alive 
          ? 'bg-emerald-500' 
          : record.status === DomainStatus.Down 
            ? 'bg-rose-500' 
            : 'bg-slate-300 dark:bg-slate-600';
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
      console.error('Failed to copy:', error);
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
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-3 text-slate-400">
                    <Search size={24} />
                </div>
                <h3 className="text-slate-900 dark:text-white font-medium text-lg">No matching domains</h3>
                <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto text-sm">Try adjusting your filters to find what you're looking for.</p>
            </div>
        );
    }

    return (
      <div className="text-center py-24 bg-white dark:bg-slate-800 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/20 to-transparent dark:from-indigo-900/10 pointer-events-none" />
        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-6 text-indigo-500 transform group-hover:scale-110 transition-transform duration-500 shadow-glow">
            <LayoutDashboard size={32} />
        </div>
        <h3 className="text-slate-900 dark:text-white font-display font-bold text-xl mb-2">Ready to monitor your domains?</h3>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm mb-8 leading-relaxed">
            Track uptime, latency, SSL status, and domain expiry in one powerful dashboard. Start by adding your first domain above.
        </p>
        <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className={`w-8 h-8 rounded-full border-2 border-white dark:border-slate-800 bg-slate-${100 + i*100} dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold`}>
                        {['G', 'A', 'M'][i-1]}
                    </div>
                ))}
            </div>
            <p className="text-xs text-slate-400 font-medium">Trusted by teams worldwide</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden" role="region" aria-label="Domains table">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0" role="grid" aria-rowcount={domains.length + 1}>
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold" role="row">
              <th className="p-4 w-12 text-center" role="columnheader" aria-label="Select">
                <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer transition-all"
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
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
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
                  className={`group transition-all duration-300 ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/50'}`}
                >
                  <td className="p-4 text-center align-middle" role="gridcell">
                     <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer transition-all opacity-100 md:opacity-30 md:group-hover:opacity-100 checked:opacity-100"
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
                          className="border border-indigo-300 dark:border-indigo-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-[240px] shadow-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
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
                                  className="font-semibold text-slate-800 dark:text-white text-sm truncate max-w-[150px] sm:max-w-[200px] md:max-w-[300px] cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-2 group/domain"
                                >
                                  {domain.url}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(domain.url, domain.id);
                                    }}
                                    className="opacity-0 group-hover/domain:opacity-100 p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all"
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
                                className="text-slate-300 hover:text-indigo-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
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
                                  <span className="text-[10px] uppercase font-bold text-slate-300 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-700 px-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">Group</span>
                                )}
                              </button>
                              
                              {editingGroupId === domain.id && (
                                <div className="absolute top-full left-0 mt-1 z-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 min-w-[160px] animate-in fade-in zoom-in-95 origin-top-left">
                                  <div className="flex items-center justify-between mb-2 px-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Group</span>
                                    <button onClick={() => setEditingGroupId(null)}><X size={12} className="text-slate-400 hover:text-slate-600" /></button>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      onEditGroup?.(domain.id, undefined);
                                      setEditingGroupId(null);
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
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
                                      className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-2"
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
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400 group/tag hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer transition-colors"
                                    onClick={() => removeTag(domain.id, domain.tags, tag)}
                                    title="Click to remove"
                                  >
                                    {tag}
                                    <X size={8} className="opacity-0 group-hover/tag:opacity-100" />
                                  </span>
                                ))}
                                <button 
                                  onClick={() => setEditingTagsId(domain.id)}
                                  className="text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                  title="Add Tag"
                                >
                                  <Plus size={10} />
                                </button>

                                {editingTagsId === domain.id && (
                                  <div className="absolute top-full left-0 mt-1 z-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 min-w-[140px] animate-in fade-in zoom-in-95 origin-top-left flex gap-1">
                                    <input
                                      autoFocus
                                      type="text"
                                      placeholder="New tag..."
                                      value={newTag}
                                      onChange={(e) => setNewTag(e.target.value)}
                                      className="bg-transparent border-none outline-none text-xs w-full text-slate-900 dark:text-white"
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
                                    }} className="text-indigo-600"><Check size={14} /></button>
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
                            <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded text-[9px] font-mono text-indigo-700 dark:text-indigo-300 truncate max-w-[100px]">
                              {ns}
                            </span>
                          ))
                        ) : domain.dns?.ns && domain.dns.ns.length > 0 ? (
                          domain.dns.ns.slice(0, 2).map((ns, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded text-[9px] font-mono text-slate-600 dark:text-slate-400 truncate max-w-[100px]">
                              {ns}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">-</span>
                        )}
                        {((domain.expiry?.nameServers?.length || domain.dns?.ns?.length || 0) > 2) && (
                          <span className="px-2 py-0.5 text-[9px] text-slate-400">+{((domain.expiry?.nameServers?.length || 0) + (domain.dns?.ns?.length || 0)) - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="p-4 align-middle text-sm text-slate-600 dark:text-slate-300 font-mono">
                    {isChecking ? (
                        <Skeleton className="w-12 h-4" />
                    ) : (
                        domain.latency ? <span className={domain.latency > 500 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}>{domain.latency}ms</span> : <span className="text-slate-300 dark:text-slate-600">-</span>
                    )}
                  </td>
                  <td className="p-4 align-middle text-sm text-slate-500 dark:text-slate-400 hidden md:table-cell">
                    {isChecking ? (
                        <Skeleton className="w-20 h-4" />
                    ) : (
                        domain.lastChecked ? (
                          <span className="flex items-center gap-2">
                            {formatRelativeTime(domain.lastChecked)}
                            <span className="text-xs text-slate-400">({domain.lastChecked.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})</span>
                          </span>
                        ) : <span className="text-slate-300 dark:text-slate-600">Never</span>
                    )}
                  </td>
                  <td className="p-4 align-middle hidden lg:table-cell">
                    <HistorySparkline history={domain.history} />
                  </td>
                  <td className="p-4 align-middle text-right" role="gridcell">
                    <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewHistory && onViewHistory(domain)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        title="View history"
                        aria-label={`View history for ${domain.url}`}
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => onCheck(domain.id)}
                        disabled={isChecking}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        title="Check status"
                        aria-label={`Check status for ${domain.url}`}
                        aria-busy={isChecking}
                      >
                        <RefreshCw size={16} className={isChecking ? "animate-spin" : ""} />
                      </button>
                      <button
                        onClick={() => startEdit(domain)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
                        title="Edit domain"
                        aria-label={`Edit domain ${domain.url}`}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onRemove(domain.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500"
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