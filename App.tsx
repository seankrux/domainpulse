import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { Domain, DomainStatus, DomainStats, SortField, SortOrder, DomainGroup, SSLStatus } from './types';
import { parseCSV, exportToCSV } from './utils/csvHelper';
import { loadDomains, saveDomains, loadSettings, saveSettings, AppSettings, loadGroups, saveGroups, addGroup, removeGroup, updateGroup } from './utils/storage';
import { useNotification } from './components/NotificationProvider';
import { useAuth } from './components/AuthProvider';
import { StatsOverview } from './components/StatsOverview';
import { DomainTable } from './components/DomainTable';
import { HistoryChart } from './components/HistoryChart';
import { GroupManager } from './components/GroupManager';
import { requestNotificationPermission, sendDomainDownNotification, sendDomainUpNotification, playAlertSound } from './services/notificationService';
import { validateAndNormalizeUrl } from './services/domainService';

// New Components & Hooks
import { useMonitoring } from './hooks/useMonitoring';
import { Header } from './components/Dashboard/Header';
import { SettingsPanel } from './components/Dashboard/SettingsPanel';
import { HeroSection } from './components/Dashboard/HeroSection';
import { FilterBar } from './components/Dashboard/FilterBar';
import { BulkImportModal } from './components/Dashboard/BulkImportModal';
import { DomainDetailModal } from './components/Dashboard/DomainDetailModal';
import { ConfirmModal } from './components/Dashboard/ConfirmModal';
import { SkipLinks } from './components/Accessibility';
import { BottomPanel } from './components/BottomPanel';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useAnnounce } from './components/Accessibility';
import { logger } from './utils/logger';

// Simple UUID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

const App: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>(() => loadDomains());
  const [groups, setGroups] = useState<DomainGroup[]>(() => loadGroups());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newDomainUrl, setNewDomainUrl] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [viewingDetailId, setViewingDetailId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [statusFilter, setStatusFilter] = useState<DomainStatus | 'ALL'>(() => (localStorage.getItem('domainpulse_status_filter') as any) || 'ALL');
  const [sslFilter, setSslFilter] = useState<SSLStatus | 'ALL'>(() => (localStorage.getItem('domainpulse_ssl_filter') as any) || 'ALL');
  const [groupFilter, setGroupFilter] = useState<string | 'ALL'>(() => localStorage.getItem('domainpulse_group_filter') || 'ALL');
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previousStatuses, setPreviousStatuses] = useState<Map<string, DomainStatus>>(new Map());
  
  const [sortField, setSortField] = useState<SortField>(() => (localStorage.getItem('domainpulse_sort_field') as SortField) || 'lastChecked');
  const [sortOrder, setSortOrder] = useState<SortOrder>(() => (localStorage.getItem('domainpulse_sort_order') as SortOrder) || 'desc');

  const { showSuccess, showError, showInfo } = useNotification();
  const { logout } = useAuth();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { announce, Announcer } = useAnnounce();

  // Monitoring Hook
  const {
    isCheckingAll,
    checkProgress,
    checkBatch,
    checkAllDomains,
    checkSingleDomain
  } = useMonitoring({
    domains,
    setDomains,
    maxHistoryRecords: settings.maxHistoryRecords,
    customUserAgent: settings.customUserAgent,
    checkTimeout: settings.checkTimeout,
    showSuccess
  });

  // Refs for stability
  const domainsRef = useRef(domains);
  const checkAllDomainsRef = useRef(checkAllDomains);

  useEffect(() => {
    domainsRef.current = domains;
    checkAllDomainsRef.current = checkAllDomains;
  }, [domains, checkAllDomains]);

  // Persistence Effects
  useEffect(() => {
    saveDomains(domains);
  }, [domains]);

  useEffect(() => {
    localStorage.setItem('domainpulse_status_filter', statusFilter);
    localStorage.setItem('domainpulse_ssl_filter', sslFilter);
    localStorage.setItem('domainpulse_group_filter', groupFilter);
    localStorage.setItem('domainpulse_sort_field', sortField);
    localStorage.setItem('domainpulse_sort_order', sortOrder);
  }, [statusFilter, sslFilter, groupFilter, sortField, sortOrder]);

  useEffect(() => {
    saveGroups(groups);
  }, [groups]);

  useEffect(() => {
    saveSettings(settings);
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // Actions
  const addDomain = useCallback((urlInput: string, groupId?: string, tags?: string[]) => {
    setInputError(null);
    const validation = validateAndNormalizeUrl(urlInput);
    if (!validation.valid || !validation.url) {
      setInputError(validation.error || 'Invalid domain');
      return;
    }
    const normalized = validation.url;
    if (domains.some(d => d.url === normalized)) {
      setInputError('This domain is already being monitored.');
      return;
    }
    const newDomain: Domain = {
      id: generateId(),
      url: normalized,
      status: DomainStatus.Unknown,
      addedAt: new Date(),
      history: [],
      groupId,
      tags: tags || []
    };
    setDomains(prev => [newDomain, ...prev]);
    setNewDomainUrl('');
    showSuccess(`Added ${normalized} to monitoring`);
    checkSingleDomain(newDomain.id, normalized);
  }, [domains, checkSingleDomain, showSuccess]);

  const handleBulkImport = useCallback((newUrls: string[]) => {
    const existingUrls = new Set(domains.map(d => d.url));
    const validNewDomains: Domain[] = [];
    let errorCount = 0;
    let duplicateCount = 0;

    newUrls.forEach(urlInput => {
      const validation = validateAndNormalizeUrl(urlInput);
      if (!validation.valid || !validation.url) {
        errorCount++;
        return;
      }
      
      const normalized = validation.url;
      if (existingUrls.has(normalized)) {
        duplicateCount++;
        return;
      }

      validNewDomains.push({
        id: generateId(),
        url: normalized,
        status: DomainStatus.Unknown,
        addedAt: new Date(),
        history: [],
        tags: []
      } as Domain);
      
      existingUrls.add(normalized);
    });

    if (validNewDomains.length > 0) {
      setDomains(prev => [...validNewDomains, ...prev]);
      showSuccess(`Successfully imported ${validNewDomains.length} domains`);
      checkBatch(validNewDomains);
    }

    if (errorCount > 0 || duplicateCount > 0) {
      showInfo(`Imported with ${duplicateCount} duplicates and ${errorCount} invalid URLs skipped.`);
    }
  }, [domains, checkBatch, showSuccess, showInfo]);

  const removeDomain = useCallback((id: string) => {
    setDomains(prev => prev.filter(d => d.id !== id));
    if (selectedIds.has(id)) {
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    }
    showInfo('Domain removed');
  }, [selectedIds, showInfo]);

  const removeSelectedDomains = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const confirmDeleteSelected = useCallback(() => {
    setDomains(prev => prev.filter(d => !selectedIds.has(d.id)));
    setSelectedIds(new Set());
    showInfo(`Removed ${selectedIds.size} domains`);
    setShowDeleteConfirm(false);
  }, [selectedIds, showInfo]);

  const checkSelectedDomains = useCallback(() => {
    if (isCheckingAll || selectedIds.size === 0) return;
    const domainsToCheck = domainsRef.current.filter(d => selectedIds.has(d.id) && d.status !== DomainStatus.Checking);
    if (domainsToCheck.length === 0) return;
    checkBatch(domainsToCheck);
    showSuccess(`Checking ${domainsToCheck.length} domains`);
  }, [isCheckingAll, selectedIds, checkBatch, showSuccess]);

  const assignSelectedToGroup = useCallback((groupId?: string) => {
    setDomains(prev => prev.map(d => 
      selectedIds.has(d.id) ? { ...d, groupId } : d
    ));
    const groupName = groupId ? groups.find(g => g.id === groupId)?.name : 'no group';
    showSuccess(`Assigned ${selectedIds.size} domains to ${groupName}`);
  }, [selectedIds, groups, showSuccess]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseCSV(content);
      const newDomains = parsed.map(p => ({
        id: generateId(),
        url: p.url!,
        status: DomainStatus.Unknown,
        addedAt: new Date(),
        history: [],
        tags: []
      } as Domain));
      setDomains(prev => {
        const existingUrls = new Set(prev.map(d => d.url));
        const filteredNew = newDomains.filter(d => !existingUrls.has(d.url));
        return [...filteredNew, ...prev];
      });
      showInfo(`Imported ${parsed.length} domains from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [showInfo]);

  // CSV Export with error handling
  const handleExportCSV = useCallback(() => {
    try {
      exportToCSV(domains);
      showSuccess('Domains exported successfully');
    } catch (error) {
      logger.error('CSV export failed', error);
      showError('Failed to export domains. Please try again.');
    }
  }, [domains, showSuccess, showError]);

  // Notifications
  useEffect(() => {
    if (!settings.enableNotifications) return;
    domains.forEach(domain => {
      const prevStatus = previousStatuses.get(domain.id);
      if (!prevStatus || prevStatus === domain.status) return;
      if (domain.status === DomainStatus.Down &&
          (prevStatus === DomainStatus.Alive || prevStatus === DomainStatus.Unknown)) {
        if (settings.playSound) playAlertSound();
        sendDomainDownNotification(domain.url, domain.statusCode);
        showInfo(`${domain.url} is down!`);
      }
      if (domain.status === DomainStatus.Alive && prevStatus === DomainStatus.Down) {
        sendDomainUpNotification(domain.url, domain.latency);
        showSuccess(`${domain.url} is back up!`);
      }
    });
    const newMap = new Map<string, DomainStatus>();
    domains.forEach(d => newMap.set(d.id, d.status));
    // Limit the size of previousStatuses map to prevent memory leak
    if (newMap.size > 100) {
      const entries = Array.from(newMap.entries()).slice(-100);
      setPreviousStatuses(new Map(entries));
    } else {
      setPreviousStatuses(newMap);
    }
  }, [domains, settings.enableNotifications, settings.playSound, previousStatuses, showInfo, showSuccess]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K: Focus search input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
      // Cmd+Enter: Check all domains
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        checkAllDomains();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [checkAllDomains]);

  // Computed Stats
  const stats: DomainStats = useMemo(() => {
    const total = domains.length;
    const alive = domains.filter(d => d.status === DomainStatus.Alive).length;
    const down = domains.filter(d => d.status === DomainStatus.Down).length;
    const unknown = domains.filter(d => d.status === DomainStatus.Unknown || d.status === DomainStatus.Checking).length;
    const responsiveDomains = domains.filter(d => d.latency !== undefined && d.latency > 0);
    const avgLatency = responsiveDomains.length > 0
      ? responsiveDomains.reduce((acc, curr) => acc + (curr.latency || 0), 0) / responsiveDomains.length
      : 0;
    const totalRecords = domains.reduce((acc, d) => acc + d.history.length, 0);
    const aliveRecords = domains.reduce((acc, d) => 
      acc + d.history.filter(h => h.status === DomainStatus.Alive).length, 0
    );
    const uptime = totalRecords > 0 ? (aliveRecords / totalRecords) * 100 : 100;
    return { total, alive, down, unknown, avgLatency, uptime };
  }, [domains]);

  // Filter Counts - optimized single-pass computation
  const filterCounts = useMemo(() => {
    const statusCounts: Record<DomainStatus, number> = {
      [DomainStatus.Alive]: 0,
      [DomainStatus.Down]: 0,
      [DomainStatus.Unknown]: 0,
      [DomainStatus.Checking]: 0,
      [DomainStatus.Error]: 0,
    };
    
    const sslCounts: Record<SSLStatus, number> = {
      [SSLStatus.Valid]: 0,
      [SSLStatus.Expiring]: 0,
      [SSLStatus.Expired]: 0,
      [SSLStatus.Invalid]: 0,
      [SSLStatus.Unknown]: 0,
    };
    
    const groupCounts = new Map<string, number>();
    groups.forEach(g => groupCounts.set(g.id, 0));
    
    // Single pass through domains array
    domains.forEach(d => {
      statusCounts[d.status]++;
      sslCounts[d.ssl?.status || SSLStatus.Unknown]++;
      if (d.groupId) {
        const current = groupCounts.get(d.groupId) || 0;
        groupCounts.set(d.groupId, current + 1);
      }
    });
    
    groupCounts.set('ALL', domains.length);
    
    return { statusCounts, sslCounts, groupCounts };
  }, [domains, groups]);

  // Filtering and Sorting
  const displayDomains = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    const filtered = domains.filter(d => {
      const matchesSearch = d.url.toLowerCase().includes(normalizedFilter);
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
      const matchesSSL = sslFilter === 'ALL' || d.ssl?.status === sslFilter;
      const matchesGroup = groupFilter === 'ALL' || d.groupId === groupFilter;
      return matchesSearch && matchesStatus && matchesSSL && matchesGroup;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'url': comparison = a.url.localeCompare(b.url); break;
        case 'status': comparison = a.status.localeCompare(b.status); break;
        case 'latency': comparison = (a.latency || 0) - (b.latency || 0); break;
        case 'lastChecked': comparison = (a.lastChecked?.getTime() || 0) - (b.lastChecked?.getTime() || 0); break;
        case 'ssl': {
          const sslOrder = { [SSLStatus.Valid]: 0, [SSLStatus.Expiring]: 1, [SSLStatus.Expired]: 2, [SSLStatus.Invalid]: 3, [SSLStatus.Unknown]: 4 };
          comparison = (sslOrder[a.ssl?.status || SSLStatus.Unknown] || 4) - (sslOrder[b.ssl?.status || SSLStatus.Unknown] || 4);
          break;
        }
        case 'expiry': {
          const expiryOrder = { active: 0, expiring: 1, expired: 2, unknown: 3 };
          comparison = (expiryOrder[a.expiry?.status || 'unknown'] || 3) - (expiryOrder[b.expiry?.status || 'unknown'] || 3);
          break;
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return filtered;
  }, [domains, filter, statusFilter, sslFilter, groupFilter, sortField, sortOrder]);

  const viewingHistory = useMemo(() => {
    if (!viewingHistoryId) return null;
    return domains.find(d => d.id === viewingHistoryId) || null;
  }, [viewingHistoryId, domains]);

  const viewingDetail = useMemo(() => {
    if (!viewingDetailId) return null;
    return domains.find(d => d.id === viewingDetailId) || null;
  }, [viewingDetailId, domains]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    setSelectedIds(prev => {
      const allVisibleSelected = displayDomains.every(d => prev.has(d.id));
      if (allVisibleSelected) {
        const next = new Set(prev);
        displayDomains.forEach(d => next.delete(d.id));
        return next;
      }
      const next = new Set(prev);
      displayDomains.forEach(d => next.add(d.id));
      return next;
    });
  }, [displayDomains]);

  const handleSort = useCallback((field: SortField) => {
    setSortField(prevField => {
      if (prevField === field) {
        setSortOrder(prevOrder => prevOrder === 'asc' ? 'desc' : 'asc');
        return prevField;
      }
      setSortOrder('asc');
      return field;
    });
  }, []);

  const scrollToDomain = useCallback((domainId: string) => {
    const element = document.getElementById(`domain-${domainId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900');
      setTimeout(() => element.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-900'), 3000);
    }
  }, []);

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 transition-colors duration-300 ${isCheckingAll ? 'animate-pulse-slow' : ''}`}>
      {/* Accessibility: Skip Links */}
      <SkipLinks />
      
      {/* Accessibility: Screen Reader Announcements */}
      <Announcer />

      <Header
        settings={settings}
        toggleDarkMode={() => setSettings(s => ({ ...s, darkMode: !s.darkMode }))}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        logout={logout}
      />

      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {showSettings && (
          <SettingsPanel 
            settings={settings}
            setSettings={setSettings}
            onClose={() => setShowSettings(false)}
            showSuccess={showSuccess}
            showError={showError}
            showInfo={showInfo}
            requestNotificationPermission={requestNotificationPermission}
          />
        )}

        <HeroSection 
          domainCount={domains.length}
          newDomainUrl={newDomainUrl}
          setNewDomainUrl={setNewDomainUrl}
          inputError={inputError}
          setInputError={setInputError}
          onAddDomain={addDomain}
          onShowBulkImport={() => setShowBulkImport(true)}
        />

        <StatsOverview stats={stats} />

        {showBulkImport && (
          <BulkImportModal 
            onClose={() => setShowBulkImport(false)}
            onImport={handleBulkImport}
          />
        )}

        {isCheckingAll && checkProgress.total > 0 && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Checking domains...</span>
                <span className="text-xs font-mono">{checkProgress.current} / {checkProgress.total}</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-300" style={{ width: `${(checkProgress.current / checkProgress.total) * 100}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <div id="filters">
            <FilterBar
              filter={filter} setFilter={setFilter}
              statusFilter={statusFilter} setStatusFilter={setStatusFilter}
              sslFilter={sslFilter} setSslFilter={setSslFilter}
              groupFilter={groupFilter} setGroupFilter={setGroupFilter}
              groups={groups} setShowGroupManager={setShowGroupManager}
              sortField={sortField} handleSort={handleSort} sortOrder={sortOrder}
              selectedCount={selectedIds.size}
              isCheckingAll={isCheckingAll}
              onCheckBatch={checkSelectedDomains}
              onCheckAll={() => checkAllDomains()}
              onRemoveSelected={removeSelectedDomains}
              onAssignGroup={assignSelectedToGroup}
              handleFileUpload={handleFileUpload}
              onExportCSV={handleExportCSV}
              domainCount={domains.length}
              filterCounts={filterCounts}
            />
          </div>

          <div id="domain-table" role="region" aria-label="Domain list">
            <DomainTable
              domains={displayDomains}
              groups={groups}
              isFiltered={filter.length > 0 || statusFilter !== 'ALL' || sslFilter !== 'ALL' || groupFilter !== 'ALL'}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleAll={handleToggleAll}
              onRemove={removeDomain}
              onUpdate={(id, url) => {
                const validation = validateAndNormalizeUrl(url);
                if (!validation.valid || !validation.url) {
                  showError('Invalid domain format.');
                  return;
                }
                setDomains(prev => prev.map(d => d.id === id ? { ...d, url: validation.url! } : d));
                checkSingleDomain(id, validation.url);
              }}
              onCheck={(id) => {
                const domain = domains.find(d => d.id === id);
                if (domain?.url) checkSingleDomain(id, domain.url);
              }}
              onEditTags={(id, tags) => setDomains(prev => prev.map(d => d.id === id ? { ...d, tags } : d))}
              onEditGroup={(id, groupId) => setDomains(prev => prev.map(d => d.id === id ? { ...d, groupId } : d))}
              onViewHistory={(domain) => setViewingHistoryId(domain.id)}
              onViewDetails={(domain) => setViewingDetailId(domain.id)}
            />
          </div>
        </div>
      </main>

      {/* Bottom Panel - Alerts & Stats (Collapsible) */}
      <BottomPanel domains={domains} onViewDomain={scrollToDomain} />

      <footer id="footer" className="text-center py-8 text-sm text-slate-400" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4">
          <p>Made with 💛 by BigSean</p>
          <div className="mt-2 text-xs text-slate-500">
            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded mx-1">⌘K</kbd> Focus search
            <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded mx-1">⌘Enter</kbd> Check all
          </div>
        </div>
      </footer>

      {viewingDetail && (
        <DomainDetailModal 
          domain={viewingDetail}
          onClose={() => setViewingDetailId(null)}
        />
      )}

      {viewingHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingHistoryId(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">History - {viewingHistory.url}</h2>
              <button onClick={() => setViewingHistoryId(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6">
              <HistoryChart domain={viewingHistory} />
            </div>
          </div>
        </div>
      )}

      {showGroupManager && (
        <GroupManager
          groups={groups}
          onAddGroup={(group) => { addGroup(group); setGroups([...groups, group]); }}
          onUpdateGroup={(id, updates) => { updateGroup(id, updates); setGroups(groups.map(g => g.id === id ? { ...g, ...updates } : g)); }}
          onRemoveGroup={(id) => { removeGroup(id); setGroups(groups.filter(g => g.id !== id)); setDomains(domains.map(d => d.groupId === id ? { ...d, groupId: undefined } : d)); }}
          onClose={() => setShowGroupManager(false)}
        />
      )}

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteSelected}
        title="Delete Domains"
        message={`Are you sure you want to remove ${selectedIds.size} domain${selectedIds.size === 1 ? '' : 's'}? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      <footer className="text-center py-8 text-sm text-slate-400">
        Made with 💛 by BigSean
      </footer>
    </div>
  );
};

export default App;
