import React, { useState, useRef, useEffect } from 'react';
import { Domain, DomainStatus, SSLStatus, DomainGroup } from '../types';
import { Trash2, RefreshCw, ExternalLink, Edit2, Check, X, MoreHorizontal, Search, History, Shield, Tag, Calendar } from 'lucide-react';
import { getSSLStatusColor, getSSLStatusLabel } from '../services/sslService';
import { getExpiryStatusColor, getExpiryStatusLabel } from '../services/expiryService';

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
}

const Skeleton = ({ className = "w-16" }: { className?: string }) => (
  <div className={`h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse ${className}`} />
);

const Favicon = ({ url }: { url: string }) => {
  const [error, setError] = useState(false);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${url}&sz=128`;

  if (error) {
    return (
      <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-indigo-100 dark:border-indigo-800 flex-shrink-0">
        {url.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      className="w-8 h-8 rounded-full bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 object-contain p-0.5 flex-shrink-0"
      onError={() => setError(true)}
    />
  );
};

const StatusBadge: React.FC<{ status: DomainStatus; statusCode?: number }> = ({ status, statusCode }) => {
  const configs = {
    [DomainStatus.Alive]: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
    [DomainStatus.Down]: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
    [DomainStatus.Checking]: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
    [DomainStatus.Unknown]: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
    [DomainStatus.Error]: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  };

  const config = configs[status];

  let displayText = status === DomainStatus.Checking ? 'Checking...' : (status.charAt(0) + status.slice(1).toLowerCase());

  if (statusCode && status !== DomainStatus.Checking && status !== DomainStatus.Unknown) {
    displayText = `${statusCode}`;
    if (statusCode === 200) displayText = '200 OK';
  }

  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold ${config.bg} ${config.text} bg-opacity-50 border border-transparent whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} ${status === DomainStatus.Checking ? 'animate-pulse' : ''}`} />
      {displayText}
    </span>
  );
};

const SSLBadge: React.FC<{ ssl: any }> = ({ ssl }) => {
  if (!ssl || ssl.status === SSLStatus.Unknown) {
    return <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>;
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorClass}`} title={ssl.issuer || label}>
      <Shield size={10} />
      {displayLabel}
    </span>
  );
};

const GroupBadge: React.FC<{ group?: DomainGroup }> = ({ group }) => {
  if (!group) return null;
  
  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${group.color}20`, color: group.color }}
    >
      {group.name}
    </span>
  );
};

const TagBadges: React.FC<{ tags: string[] }> = ({ tags }) => {
  if (!tags || tags.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {tags.slice(0, 3).map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
          <Tag size={8} />
          {tag}
        </span>
      ))}
      {tags.length > 3 && (
        <span className="text-xs text-slate-400">+{tags.length - 3}</span>
      )}
    </div>
  );
};

const ExpiryBadge: React.FC<{ expiry?: any }> = ({ expiry }) => {
  if (!expiry) return null;
  
  const colorClass = getExpiryStatusColor(expiry.status);
  const label = getExpiryStatusLabel(expiry.status);
  
  let displayLabel = label;
  if (expiry.daysUntilExpiry !== undefined && expiry.status === 'active') {
    displayLabel = `${expiry.daysUntilExpiry}d`;
  } else if (expiry.status === 'expiring') {
    displayLabel = `${expiry.daysUntilExpiry}d`;
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colorClass}`} title={expiry.registrar || label}>
      <Calendar size={10} />
      {displayLabel}
    </span>
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
    onViewHistory
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
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
      <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
            <MoreHorizontal className="text-slate-300" />
        </div>
        <h3 className="text-slate-900 dark:text-white font-semibold text-lg">No domains monitored</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">Start by adding a domain manually or import a CSV file to bulk check status.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
              <th className="p-4 w-12 text-center">
                <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer transition-all"
                    checked={allSelected}
                    onChange={onToggleAll}
                />
              </th>
              <th className="p-4 pl-2">Domain</th>
              <th className="p-4">Status</th>
              <th className="p-4">SSL</th>
              <th className="p-4">Expiry</th>
              <th className="p-4">Latency</th>
              <th className="p-4 hidden md:table-cell">Last Checked</th>
              <th className="p-4 hidden lg:table-cell">History</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
            {domains.map((domain) => {
              const isChecking = domain.status === DomainStatus.Checking;
              const isSelected = selectedIds.has(domain.id);

              return (
                <tr
                  key={domain.id}
                  className={`group transition-all duration-200 ${isSelected ? 'bg-indigo-50/60 dark:bg-indigo-900/10' : 'hover:bg-slate-50/80 dark:hover:bg-slate-700/50'}`}
                >
                  <td className="p-4 text-center align-middle">
                     <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer transition-all opacity-100 md:opacity-30 md:group-hover:opacity-100 checked:opacity-100"
                        checked={isSelected}
                        onChange={() => onToggleSelect(domain.id)}
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
                                <span className="font-semibold text-slate-800 dark:text-white text-sm truncate max-w-[150px] sm:max-w-[200px] md:max-w-[300px]">{domain.url}</span>
                                <a
                                href={`https://${domain.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-300 hover:text-indigo-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                >
                                <ExternalLink size={12} />
                                </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <GroupBadge group={groups?.find(g => g.id === domain.groupId)} />
                              <TagBadges tags={domain.tags || []} />
                            </div>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="p-4 align-middle">
                    <StatusBadge status={domain.status} statusCode={domain.statusCode} />
                  </td>
                  <td className="p-4 align-middle">
                    <SSLBadge ssl={domain.ssl} />
                  </td>
                  <td className="p-4 align-middle">
                    <ExpiryBadge expiry={domain.expiry} />
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
                        domain.lastChecked ? domain.lastChecked.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : <span className="text-slate-300 dark:text-slate-600">Never</span>
                    )}
                  </td>
                  <td className="p-4 align-middle hidden lg:table-cell">
                    <HistorySparkline history={domain.history} />
                  </td>
                  <td className="p-4 align-middle text-right">
                    <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onViewHistory && onViewHistory(domain)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors"
                        title="View History"
                      >
                        <History size={16} />
                      </button>
                      <button
                        onClick={() => onCheck(domain.id)}
                        disabled={isChecking}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors disabled:opacity-50"
                        title="Check Status"
                      >
                        <RefreshCw size={16} className={isChecking ? "animate-spin" : ""} />
                      </button>
                      <button
                        onClick={() => startEdit(domain)}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-colors"
                        title="Edit Domain"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => onRemove(domain.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
                        title="Remove"
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