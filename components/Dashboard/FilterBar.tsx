import React from 'react';
import { Search, FolderPlus, RefreshCw, Trash2, Upload, Download, Play, SortAsc, SortDesc } from 'lucide-react';
import { DomainStatus, SSLStatus, DomainGroup, SortField, SortOrder } from '../../types';

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
  domainCount
}) => {
  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-end sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:w-64 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16} />
          <input
            type="text"
            placeholder="Filter domains... (⌘K)"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm shadow-sm transition-all text-slate-900 dark:text-white"
          />
        </div>

        {/* Tools */}
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded uppercase tracking-wider">{selectedCount} Selected</span>
              
              {/* Bulk Group Dropdown */}
              <div className="relative group/bulk">
                <button className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1" title="Assign Group">
                  <FolderPlus size={18} />
                </button>
                <div className="absolute bottom-full mb-2 left-0 hidden group-hover/bulk:block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 min-w-[160px] z-30 animate-in fade-in zoom-in-95 origin-bottom">
                  <p className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">Assign to Group</p>
                  <button 
                    onClick={() => onAssignGroup(undefined)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                  >
                    No Group
                  </button>
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => onAssignGroup(group.id)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors flex items-center gap-2"
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
                className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 p-2 rounded-lg transition-colors"
                title="Check Selected"
              >
                <RefreshCw size={18} className={isCheckingAll ? "animate-spin" : ""} />
              </button>
              <button
                onClick={onRemoveSelected}
                className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 p-2 rounded-lg transition-colors"
                title="Remove Selected"
              >
                <Trash2 size={18} />
              </button>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
            </div>
          )}

          <label className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors" title="Import CSV">
            <Upload size={18} />
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={onExportCSV}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title="Export CSV"
            disabled={domainCount === 0}
          >
            <Download size={18} />
          </button>
          <button
            onClick={onCheckAll}
            disabled={isCheckingAll || domainCount === 0}
            className={`flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm transition-all active:scale-95 ${isCheckingAll ? 'opacity-80' : ''}`}
          >
            {isCheckingAll ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play size={16} fill="currentColor" />}
            <span>Check All</span>
          </button>
        </div>
      </div>

      {/* Status Filter & Sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DomainStatus | 'ALL')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="ALL">All</option>
            <option value={DomainStatus.Alive}>Alive</option>
            <option value={DomainStatus.Down}>Down</option>
            <option value={DomainStatus.Unknown}>Unknown</option>
            <option value={DomainStatus.Error}>Error</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">SSL:</span>
          <select
            value={sslFilter}
            onChange={(e) => setSslFilter(e.target.value as SSLStatus | 'ALL')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="ALL">All</option>
            <option value={SSLStatus.Valid}>Valid</option>
            <option value={SSLStatus.Expiring}>Expiring</option>
            <option value={SSLStatus.Expired}>Expired</option>
            <option value={SSLStatus.Invalid}>Invalid</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Group:</span>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value as string | 'ALL')}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            <option value="ALL">All</option>
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          <button
            onClick={() => setShowGroupManager(true)}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
            title="Manage Groups"
          >
            <FolderPlus size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Sort:</span>
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${sortField === field ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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
