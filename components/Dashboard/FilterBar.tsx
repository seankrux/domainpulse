import React from 'react';
import { Search, FolderPlus, RefreshCw, Trash2, Upload, Download, Play, SortAsc, SortDesc } from 'lucide-react';
import { DomainStatus, SSLStatus, DomainGroup, SortField, SortOrder } from '../../types';

interface FilterCounts {
  statusCounts: Record<DomainStatus, number>;
  sslCounts: Record<SSLStatus, number>;
  groupCounts: Map<string, number>;
}

// Type guards for filter values
const isValidStatusFilter = (value: string): value is DomainStatus | 'ALL' => {
  return (['ALL', DomainStatus.Alive, DomainStatus.Down, DomainStatus.Unknown, DomainStatus.Checking, DomainStatus.Error] as string[]).includes(value);
};

const isValidSSLFilter = (value: string): value is SSLStatus | 'ALL' => {
  return (['ALL', SSLStatus.Valid, SSLStatus.Expiring, SSLStatus.Expired, SSLStatus.Invalid, SSLStatus.Unknown] as string[]).includes(value);
};

interface FilterBarProps {
  filter: string;
  setFilter: (val: string) => void;
  statusFilter: DomainStatus | 'ALL';
  setStatusFilter: (val: DomainStatus | 'ALL') => void;
  sslFilter: SSLStatus | 'ALL';
  setSslFilter: (val: SSLStatus | 'ALL') => void;
  groupFilter: string | 'ALL';
  setGroupFilter: (val: string | 'ALL') => void;
  groups: DomainGroup[];
  setShowGroupManager: (val: boolean) => void;
  sortField: SortField;
  handleSort: (field: SortField) => void;
  sortOrder: SortOrder;
  selectedCount: number;
  isCheckingAll: boolean;
  onCheckBatch: () => void;
  onCheckAll: () => void;
  onRemoveSelected: () => void;
  onAssignGroup: (groupId?: string) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExportCSV: () => void;
  domainCount: number;
  filterCounts: FilterCounts;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter, setFilter,
  statusFilter, setStatusFilter,
  sslFilter, setSslFilter,
  groupFilter, setGroupFilter,
  groups, setShowGroupManager,
  sortField, handleSort, sortOrder,
  selectedCount,
  isCheckingAll,
  onCheckBatch, onCheckAll,
  onRemoveSelected,
  onAssignGroup,
  handleFileUpload,
  onExportCSV,
  domainCount,
  filterCounts
}) => {
  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-end sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-emerald-400 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Filter domains... (⌘K)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 outline-none text-sm shadow-sm transition-all text-zinc-200 placeholder:text-zinc-600"
          />
        </div>

        {/* Tools */}
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded uppercase tracking-wider">{selectedCount} Selected</span>

              {/* Bulk Group Dropdown */}
              <div className="relative group/bulk">
                <button className="bg-zinc-800 p-2 rounded-lg text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors flex items-center gap-1" title="Assign Group">
                  <FolderPlus size={18} />
                </button>
                <div className="absolute bottom-full mb-2 left-0 hidden group-hover/bulk:block bg-zinc-900 border border-zinc-800 rounded-xl shadow-xl p-2 min-w-[160px] z-30 animate-in fade-in zoom-in-95 origin-bottom">
                  <p className="text-[10px] font-bold text-zinc-600 px-3 py-1 uppercase tracking-wider">Assign to Group</p>
                  <button
                    onClick={() => onAssignGroup(undefined)}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors"
                  >
                    No Group
                  </button>
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => onAssignGroup(group.id)}
                      className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }}></div>
                      {group.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={onCheckBatch}
                disabled={isCheckingAll}
                className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 p-2 rounded-lg transition-colors border border-emerald-500/20"
                title="Check Selected"
              >
                <RefreshCw size={18} className={isCheckingAll ? "animate-spin" : ""} />
              </button>
              <button
                onClick={onRemoveSelected}
                className="bg-red-500/10 text-red-400 hover:bg-red-500/20 p-2 rounded-lg transition-colors border border-red-500/20"
                title="Remove Selected"
              >
                <Trash2 size={18} />
              </button>
              <div className="w-px h-6 bg-zinc-800 mx-1"></div>
            </div>
          )}

          <label className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors" title="Import CSV">
            <Upload size={18} />
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={onExportCSV}
            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Export CSV"
            disabled={domainCount === 0}
          >
            <Download size={18} />
          </button>
          <button
            onClick={onCheckAll}
            disabled={isCheckingAll || domainCount === 0}
            className={`flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 shadow-emerald-500/20 ${isCheckingAll ? 'opacity-80' : ''}`}
          >
            {isCheckingAll ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={16} fill="currentColor" />}
            <span>Check All</span>
          </button>
        </div>
      </div>

      {/* Status Filter & Sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              const value = e.target.value;
              if (isValidStatusFilter(value)) {
                setStatusFilter(value);
              }
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 outline-none"
          >
            <option value="ALL">All ({domainCount})</option>
            <option value={DomainStatus.Alive}>Alive ({filterCounts.statusCounts[DomainStatus.Alive] || 0})</option>
            <option value={DomainStatus.Down}>Down ({filterCounts.statusCounts[DomainStatus.Down] || 0})</option>
            <option value={DomainStatus.Unknown}>Unknown ({filterCounts.statusCounts[DomainStatus.Unknown] || 0})</option>
            <option value={DomainStatus.Error}>Error ({filterCounts.statusCounts[DomainStatus.Error] || 0})</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">SSL:</span>
          <select
            value={sslFilter}
            onChange={(e) => {
              const value = e.target.value;
              if (isValidSSLFilter(value)) {
                setSslFilter(value);
              }
            }}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 outline-none"
          >
            <option value="ALL">All ({domainCount})</option>
            <option value={SSLStatus.Valid}>Valid ({filterCounts.sslCounts[SSLStatus.Valid] || 0})</option>
            <option value={SSLStatus.Expiring}>Expiring ({filterCounts.sslCounts[SSLStatus.Expiring] || 0})</option>
            <option value={SSLStatus.Expired}>Expired ({filterCounts.sslCounts[SSLStatus.Expired] || 0})</option>
            <option value={SSLStatus.Invalid}>Invalid ({filterCounts.sslCounts[SSLStatus.Invalid] || 0})</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Group:</span>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as string | 'ALL')}
            className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 outline-none"
          >
            <option value="ALL">All ({filterCounts.groupCounts.get('ALL') || 0})</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name} ({filterCounts.groupCounts.get(group.id) || 0})</option>
            ))}
          </select>
          <button
            onClick={() => setShowGroupManager(true)}
            className="p-1.5 text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
            title="Manage Groups"
          >
            <FolderPlus size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-500">Sort:</span>
          {[
            { field: 'url', label: 'Name' },
            { field: 'status', label: 'Status' },
            { field: 'latency', label: 'Latency' },
            { field: 'lastChecked', label: 'Last Checked' },
            { field: 'ssl', label: 'SSL' },
            { field: 'expiry', label: 'Expiry' }
          ].map(({ field, label }) => (
            <button
              key={field}
              onClick={() => handleSort(field as SortField)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${sortField === field ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'}`}
              title={`Sort by ${label.toLowerCase()} (${sortOrder === 'asc' ? 'ascending' : 'descending'})`}
            >
              {label}
              {sortField === field && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
