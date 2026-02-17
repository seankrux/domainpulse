import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Plus, Upload, Download, Play, Search, LayoutDashboard, Trash2, RefreshCw, BarChart3, Settings, AlertCircle, Clock, Moon, Sun, SortAsc, SortDesc, LogOut, FolderPlus, X, ArrowRight } from 'lucide-react';
import { Domain, DomainStatus, DomainStats, StatusRecord, SortField, SortOrder, DomainGroup, SSLStatus } from './types';
import { checkDomainWithSSL, validateAndNormalizeUrl } from './services/domainService';
import { parseCSV, exportToCSV } from './utils/csvHelper';
import { loadDomains, saveDomains, loadSettings, saveSettings, AppSettings, loadGroups, saveGroups, addGroup, removeGroup, updateGroup } from './utils/storage';
import { useNotification } from './components/NotificationProvider';
import { useAuth } from './components/AuthProvider';
import { StatsOverview, DistributionChart } from './components/StatsOverview';
import { DomainTable } from './components/DomainTable';
import { HistoryChart } from './components/HistoryChart';
import { GroupManager } from './components/GroupManager';
import { requestNotificationPermission, sendDomainDownNotification, sendDomainUpNotification, playAlertSound } from './services/notificationService';

// Simple UUID generator
const generateId = () => Math.random().toString(36).substr(2, 9);

const REFRESH_INTERVALS = [
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
  { label: '5 minutes', value: 300000 },
  { label: '15 minutes', value: 900000 },
  { label: '30 minutes', value: 1800000 },
];

const App: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>(() => loadDomains());
  const [groups, setGroups] = useState<DomainGroup[]>(() => loadGroups());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newDomainUrl, setNewDomainUrl] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [sortField, setSortField] = useState<SortField>('lastChecked');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [statusFilter, setStatusFilter] = useState<DomainStatus | 'ALL'>('ALL');
  const [sslFilter, setSslFilter] = useState<SSLStatus | 'ALL'>('ALL');
  const [groupFilter, setGroupFilter] = useState<string | 'ALL'>('ALL');
  const [viewingHistoryId, setViewingHistoryId] = useState<string | null>(null);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [previousStatuses, setPreviousStatuses] = useState<Map<string, DomainStatus>>(new Map());

  // Refs for auto-refresh to avoid dependency issues
  const domainsRef = useRef(domains);
  const viewingHistoryRef = useRef<Domain | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Stabilize viewingHistory object to prevent infinite re-renders in charts
  const viewingHistory = useMemo(() => {
    if (!viewingHistoryId) return null;
    const domain = domains.find(d => d.id === viewingHistoryId);
    if (domain) {
      viewingHistoryRef.current = domain;
    }
    return viewingHistoryRef.current;
  }, [viewingHistoryId, domains]);
  
  const { showSuccess, showError, showInfo } = useNotification();
  const { logout } = useAuth();

  // Keep ref updated with latest domains
  useEffect(() => {
    domainsRef.current = domains;
  }, [domains]);

  // Persist domains to localStorage whenever they change
  useEffect(() => {
    saveDomains(domains);
  }, [domains]);

  // Persist groups
  useEffect(() => {
    saveGroups(groups);
  }, [groups]);

  // Persist settings
  useEffect(() => {
    saveSettings(settings);
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  // Actions
  const addHistoryRecord = useCallback((domainId: string, result: { status: DomainStatus; statusCode: number; latency: number }) => {
    const newRecord: StatusRecord = {
      timestamp: new Date(),
      status: result.status,
      statusCode: result.statusCode,
      latency: result.latency
    };

    setDomains(prev => prev.map(d => {
      if (d.id !== domainId) return d;
      
      const newHistory = [...d.history, newRecord];
      // Keep only last N records
      if (newHistory.length > settings.maxHistoryRecords) {
        newHistory.shift();
      }
      
      return { ...d, history: newHistory };
    }));
  }, [settings.maxHistoryRecords]);

  const checkBatch = useCallback(async (domainsToProcess: Domain[]) => {
    if (domainsToProcess.length === 0 || !workerRef.current) return;
    
    const idsToCheck = new Set(domainsToProcess.map(d => d.id));
    
    // Set all domains to Checking state first
    setDomains(prev => prev.map(d => 
      idsToCheck.has(d.id) ? { ...d, status: DomainStatus.Checking } : d
    ));

    // Send to worker
    workerRef.current.postMessage({
      type: 'CHECK_BATCH',
      domains: domainsToProcess
    });
  }, []);

  const checkAllDomains = useCallback(async (silent = false) => {
    if (isCheckingAll) return;

    if (!silent) setIsCheckingAll(true);

    const domainsToCheck = domainsRef.current.filter(d => d.status !== DomainStatus.Checking);
    await checkBatch(domainsToCheck);
  }, [isCheckingAll, checkBatch]);

  const checkAllDomainsRef = useRef<typeof checkAllDomains | null>(null);

  // Initialize Worker
  useEffect(() => {
    const MonitoringWorker = new Worker(new URL('./services/monitoring.worker.ts', import.meta.url), {
      type: 'module'
    });
    
    MonitoringWorker.onmessage = (e) => {
      const { type, domainId, result } = e.data;
      
      if (type === 'DOMAIN_RESULT') {
        setDomains(prev => 
          prev.map(d =>
            d.id === domainId ? {
              ...d,
              status: result.status,
              statusCode: result.statusCode,
              latency: result.latency,
              ssl: result.ssl,
              expiry: result.expiry,
              lastChecked: new Date()
            } : d
          )
        );
        addHistoryRecord(domainId, result);
      } else if (type === 'DOMAIN_ERROR') {
        setDomains(prev => 
          prev.map(d =>
            d.id === domainId ? { ...d, status: DomainStatus.Error, lastChecked: new Date() } : d
          )
        );
      } else if (type === 'BATCH_COMPLETE') {
        setIsCheckingAll(false);
        showSuccess('Domain check complete');
      }
    };

    // Configure worker with proxy URL
    MonitoringWorker.postMessage({
      type: 'CONFIG',
      config: {
        proxyUrl: import.meta.env.VITE_PROXY_URL || 'http://localhost:3001'
      }
    });

    workerRef.current = MonitoringWorker;

    return () => {
      MonitoringWorker.terminate();
    };
  }, [addHistoryRecord, showSuccess]);

  // Send notifications for status changes
  useEffect(() => {
    if (!settings.enableNotifications) return;

    domains.forEach(domain => {
      const prevStatus = previousStatuses.get(domain.id);
      if (!prevStatus || prevStatus === domain.status) return;

      // Domain went from Alive/Unknown to Down
      if (domain.status === DomainStatus.Down && 
          (prevStatus === DomainStatus.Alive || prevStatus === DomainStatus.Unknown)) {
        if (settings.playSound) {
          playAlertSound();
        }
        sendDomainDownNotification(domain.url, domain.statusCode);
        showInfo(`${domain.url} is down!`);
      }

      // Domain came back up
      if (domain.status === DomainStatus.Alive && prevStatus === DomainStatus.Down) {
        sendDomainUpNotification(domain.url, domain.latency);
        showSuccess(`${domain.url} is back up!`);
      }
    });

    // Update previous statuses
    const newMap = new Map<string, DomainStatus>();
    domains.forEach(d => newMap.set(d.id, d.status));
    setPreviousStatuses(newMap);
  }, [domains, settings.enableNotifications, settings.playSound, previousStatuses, showInfo, showSuccess]);

  const removeSelectedDomains = useCallback(() => {
    if (window.confirm(`Are you sure you want to remove ${selectedIds.size} domains?`)) {
      setDomains(prev => prev.filter(d => !selectedIds.has(d.id)));
      setSelectedIds(new Set());
      showInfo(`Removed ${selectedIds.size} domains`);
    }
  }, [selectedIds, showInfo]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K: Focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        (document.querySelector('input[placeholder*="Filter domains"]') as HTMLInputElement)?.focus();
      }
      // Cmd/Ctrl + Enter: Check all
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        checkAllDomainsRef.current?.();
      }
      // Delete: Remove selected
      if (e.key === 'Delete' && selectedIds.size > 0) {
        e.preventDefault();
        removeSelectedDomains();
      }
      // Escape: Clear selection
      if (e.key === 'Escape' && selectedIds.size > 0) {
        e.preventDefault();
        setSelectedIds(new Set());
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, removeSelectedDomains]);

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

    // Calculate uptime from history
    const totalRecords = domains.reduce((acc, d) => acc + d.history.length, 0);
    const aliveRecords = domains.reduce((acc, d) => 
      acc + d.history.filter(h => h.status === DomainStatus.Alive).length, 0
    );
    const uptime = totalRecords > 0 ? (aliveRecords / totalRecords) * 100 : 100;

    return { total, alive, down, unknown, avgLatency, uptime };
  }, [domains]);

  const checkSingleDomain = useCallback(async (id: string, url: string) => {
    setDomains(prev => prev.map(d => d.id === id ? { ...d, status: DomainStatus.Checking } : d));

    try {
      const result = await checkDomainWithSSL(url);
      setDomains(prev => prev.map(d =>
        d.id === id ? {
          ...d,
          status: result.status,
          statusCode: result.statusCode,
          latency: result.latency,
          ssl: result.ssl,
          lastChecked: new Date()
        } : d
      ));
      addHistoryRecord(id, result);
    } catch (error) {
      setDomains(prev => prev.map(d =>
        d.id === id ? { ...d, status: DomainStatus.Error, lastChecked: new Date() } : d
      ));
    }
  }, [addHistoryRecord]);

  // Actions
  const addDomain = (urlInput: string, groupId?: string, tags?: string[]) => {
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
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        history: []
      }));

      setDomains(prev => {
        const existingUrls = new Set(prev.map(d => d.url));
        const filteredNew = newDomains.filter(d => !existingUrls.has(d.url));
        return [...filteredNew, ...prev];
      });
      
      showInfo(`Imported ${parsed.length} domains from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Store checkAllDomains in ref so it can be called from useEffect
  useEffect(() => {
    checkAllDomainsRef.current = checkAllDomains;
  }, [checkAllDomains]);

  const checkSelectedDomains = async () => {
    if (isCheckingAll || selectedIds.size === 0) return;
    setIsCheckingAll(true);
    const domainsToCheck = domainsRef.current.filter(d => selectedIds.has(d.id) && d.status !== DomainStatus.Checking);
    await checkBatch(domainsToCheck);
    setIsCheckingAll(false);
    showSuccess(`Checked ${selectedIds.size} domains`);
  };

  const removeDomain = (id: string) => {
    setDomains(prev => prev.filter(d => d.id !== id));
    if (selectedIds.has(id)) {
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    }
    showInfo('Domain removed');
  };

  const updateDomain = (id: string, newUrl: string) => {
    const validation = validateAndNormalizeUrl(newUrl);
    const normalized = validation.url || newUrl.trim().toLowerCase();
    setDomains(prev => prev.map(d =>
      d.id === id ? { 
        ...d, 
        url: normalized, 
        status: DomainStatus.Unknown, 
        latency: undefined, 
        lastChecked: undefined, 
        statusCode: undefined,
        history: []
      } : d
    ));
    checkSingleDomain(id, normalized);
  };

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleToggleAll = () => {
    const allVisibleSelected = displayDomains.every(d => selectedIds.has(d.id));
    const newSelected = new Set(selectedIds);
    if (allVisibleSelected) {
      displayDomains.forEach(d => newSelected.delete(d.id));
    } else {
      displayDomains.forEach(d => newSelected.add(d.id));
    }
    setSelectedIds(newSelected);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const toggleDarkMode = () => {
    setSettings(prev => ({ ...prev, darkMode: !prev.darkMode }));
  };

  const toggleAutoRefresh = () => {
    setSettings(prev => ({ ...prev, autoRefresh: !prev.autoRefresh }));
    if (!settings.autoRefresh) {
      showInfo('Auto-refresh enabled');
    }
  };

  const updateRefreshInterval = (interval: number) => {
    setSettings(prev => ({ ...prev, refreshInterval: interval }));
    showInfo(`Refresh interval set to ${REFRESH_INTERVALS.find(i => i.value === interval)?.label}`);
  };

  // Filter and sort domains
  const displayDomains = useMemo(() => {
    const filtered = domains.filter(d => {
      const matchesSearch = d.url.includes(filter.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
      const matchesSSL = sslFilter === 'ALL' || d.ssl?.status === sslFilter;
      const matchesGroup = groupFilter === 'ALL' || d.groupId === groupFilter;
      return matchesSearch && matchesStatus && matchesSSL && matchesGroup;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'url':
          comparison = a.url.localeCompare(b.url);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'latency': {
          const aLatency = a.latency || 0;
          const bLatency = b.latency || 0;
          comparison = aLatency - bLatency;
          break;
        }
        case 'lastChecked': {
          const aTime = a.lastChecked?.getTime() || 0;
          const bTime = b.lastChecked?.getTime() || 0;
          comparison = aTime - bTime;
          break;
        }
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

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 pb-20 font-sans selection:bg-indigo-100 dark:selection:bg-indigo-900 transition-colors duration-300`}>
      {/* Modern Header */}
      <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-glow">
              <BarChart3 size={20} />
            </div>
            <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
              Domain<span className="text-indigo-600">Pulse</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              {settings.autoRefresh && (
                <>
                  <Clock size={14} />
                  <span>Auto-refresh: {REFRESH_INTERVALS.find(i => i.value === settings.refreshInterval)?.label}</span>
                </>
              )}
            </div>
            <button
              onClick={toggleDarkMode}
              className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
              title="Toggle dark mode"
            >
              {settings.darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors ${showSettings ? 'text-indigo-600' : ''}`}
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button
              onClick={logout}
              className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Sign out"
            >
              <LogOut size={20} />
            </button>
            <a
              href="http://localhost:3002"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 text-sm font-medium"
              title="View Website"
            >
              <span className="hidden lg:inline">Website</span>
              <ArrowRight size={16} />
            </a>
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white cursor-pointer">
              JD
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 animate-in slide-in-from-top-2">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings size={20} />
              Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.autoRefresh}
                    onChange={toggleAutoRefresh}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-medium">Auto-refresh</span>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Automatically check domains at intervals</p>
                  </div>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Refresh Interval</label>
                <select
                  value={settings.refreshInterval}
                  onChange={(e) => updateRefreshInterval(Number(e.target.value))}
                  disabled={!settings.autoRefresh}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                >
                  {REFRESH_INTERVALS.map(interval => (
                    <option key={interval.value} value={interval.value}>{interval.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableNotifications}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        requestNotificationPermission().then(granted => {
                          if (granted) {
                            setSettings(prev => ({ ...prev, enableNotifications: true }));
                            showSuccess('Notifications enabled');
                          } else {
                            showError('Notification permission denied');
                            setSettings(prev => ({ ...prev, enableNotifications: false }));
                          }
                        }).catch(() => {
                          showError('Failed to enable notifications');
                          setSettings(prev => ({ ...prev, enableNotifications: false }));
                        });
                      } else {
                        setSettings(prev => ({ ...prev, enableNotifications: false }));
                      }
                    }}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-medium">Browser Notifications</span>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Get alerts when domains go down</p>
                  </div>
                </label>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.playSound}
                    onChange={(e) => setSettings(prev => ({ ...prev, playSound: e.target.checked }))}
                    disabled={!settings.enableNotifications}
                    className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <div>
                    <span className="font-medium">Sound Alerts</span>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Play sound when domain goes down</p>
                  </div>
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Keep History Records</label>
                <select
                  value={settings.maxHistoryRecords}
                  onChange={(e) => setSettings(prev => ({ ...prev, maxHistoryRecords: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value={50}>50 records</option>
                  <option value={100}>100 records</option>
                  <option value={500}>500 records</option>
                  <option value={1000}>1000 records</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Hero / Add Section */}
        <div className="mb-10 max-w-2xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">Monitor your digital assets</h2>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Real-time uptime monitoring and latency tracking.</p>
          </div>

          <div className="relative group z-10">
            <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200 ${inputError ? 'from-red-500 to-rose-500 opacity-40' : ''}`}></div>
            <div className="relative flex items-center bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 p-2">
              <div className="pl-4 text-slate-400">
                <Plus size={20} />
              </div>
              <input
                type="text"
                placeholder="Enter domain to monitor (e.g., google.com)"
                className="flex-1 px-4 py-3 text-lg bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder:text-slate-400 font-medium"
                value={newDomainUrl}
                onChange={(e) => {
                  setNewDomainUrl(e.target.value);
                  if (inputError) setInputError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && addDomain(newDomainUrl)}
              />
              <button
                onClick={() => addDomain(newDomainUrl)}
                className="bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-md active:transform active:scale-95"
              >
                Track
              </button>
            </div>
            {inputError && (
              <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-rose-600 text-sm font-medium animate-in slide-in-from-top-2">
                <AlertCircle size={14} />
                {inputError}
              </div>
            )}
          </div>
        </div>

        {/* Statistics Grid */}
        <StatsOverview stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main Table Area */}
          <div className="lg:col-span-2 space-y-5">

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
                {selectedIds.size > 0 && (
                  <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded uppercase tracking-wider">{selectedIds.size} Selected</span>
                    <button
                      onClick={checkSelectedDomains}
                      disabled={isCheckingAll}
                      className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 p-2 rounded-lg transition-colors"
                      title="Check Selected"
                    >
                      <RefreshCw size={18} className={isCheckingAll ? "animate-spin" : ""} />
                    </button>
                    <button
                      onClick={removeSelectedDomains}
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
                  onClick={() => exportToCSV(domains)}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Export CSV"
                  disabled={domains.length === 0}
                >
                  <Download size={18} />
                </button>
                <button
                  onClick={() => checkAllDomains()}
                  disabled={isCheckingAll || domains.length === 0}
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
                <button
                  onClick={() => handleSort('url')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${sortField === 'url' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title={`Sort by name (${sortOrder === 'asc' ? 'ascending' : 'descending'})`}
                >
                  Name
                  {sortField === 'url' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </button>
                <button
                  onClick={() => handleSort('status')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${sortField === 'status' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title={`Sort by status (${sortOrder === 'asc' ? 'ascending' : 'descending'})`}
                >
                  Status
                  {sortField === 'status' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </button>
                <button
                  onClick={() => handleSort('latency')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${sortField === 'latency' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title={`Sort by latency (${sortOrder === 'asc' ? 'ascending' : 'descending'})`}
                >
                  Latency
                  {sortField === 'latency' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </button>
                <button
                  onClick={() => handleSort('lastChecked')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${sortField === 'lastChecked' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title={`Sort by last checked (${sortOrder === 'asc' ? 'ascending' : 'descending'})`}
                >
                  Last Checked
                  {sortField === 'lastChecked' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </button>
                <button
                  onClick={() => handleSort('ssl')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${sortField === 'ssl' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title={`Sort by SSL status (${sortOrder === 'asc' ? 'ascending' : 'descending'})`}
                >
                  SSL
                  {sortField === 'ssl' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </button>
                <button
                  onClick={() => handleSort('expiry')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${sortField === 'expiry' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                  title={`Sort by expiry (${sortOrder === 'asc' ? 'ascending' : 'descending'})`}
                >
                  Expiry
                  {sortField === 'expiry' && (sortOrder === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />)}
                </button>
              </div>
            </div>

            {/* Table Component */}
            <DomainTable
              domains={displayDomains}
              groups={groups}
              isFiltered={filter.length > 0 || statusFilter !== 'ALL' || sslFilter !== 'ALL' || groupFilter !== 'ALL'}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleAll={handleToggleAll}
              onRemove={removeDomain}
              onUpdate={updateDomain}
              onCheck={(id) => {
                const domain = domains.find(d => d.id === id);
                if (domain) checkSingleDomain(id, domain.url);
              }}
              onViewHistory={(domain) => setViewingHistoryId(domain.id)}
            />
          </div>

          {/* Sidebar Area */}
          <div className="space-y-6">
            <DistributionChart stats={stats} />

            {/* Pro Tip Card - Redesigned */}
            <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[50px] opacity-20 -mr-10 -mt-10 group-hover:opacity-30 transition-opacity"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-3">
                  <div className="bg-indigo-500/20 p-1.5 rounded text-indigo-300">
                    <LayoutDashboard size={16} />
                  </div>
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-indigo-200">Pro Tip</h3>
                </div>
                <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                  Need to monitor hundreds of domains? Use the CSV import feature.
                </p>
                <div className="bg-slate-800/50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-700/50">
                  <code className="text-xs font-mono text-indigo-200 block">
                    url,description<br />
                    google.com,search<br />
                    example.com,test
                  </code>
                </div>
              </div>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-700 dark:text-slate-300 mb-4">Keyboard Shortcuts</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Focus search</span>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">⌘K</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Check all</span>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">⌘Enter</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Remove selected</span>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">Del</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Clear selection</span>
                  <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono">Esc</kbd>
                </div>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* History Modal */}
      {viewingHistory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setViewingHistoryId(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">History - {viewingHistory.url}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{viewingHistory.history.length} checks recorded</p>
              </div>
              <button
                onClick={() => setViewingHistoryId(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X size={20} className="text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-6">
              <HistoryChart domain={viewingHistory} onClose={() => setViewingHistoryId(null)} />
            </div>
          </div>
        </div>
      )}

      {/* Group Manager Modal */}
      {showGroupManager && (
        <GroupManager
          groups={groups}
          onAddGroup={(group) => {
            addGroup(group);
            setGroups([...groups, group]);
            showSuccess(`Group "${group.name}" created`);
          }}
          onUpdateGroup={(groupId, updates) => {
            updateGroup(groupId, updates);
            setGroups(groups.map(g => g.id === groupId ? { ...g, ...updates } : g));
          }}
          onRemoveGroup={(groupId) => {
            removeGroup(groupId);
            setGroups(groups.filter(g => g.id !== groupId));
            setDomains(domains.map(d => d.groupId === groupId ? { ...d, groupId: undefined } : d));
          }}
          onClose={() => setShowGroupManager(false)}
        />
      )}

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
        Made with 💛 by BigSean
      </footer>
    </div>
  );
};

export default App;
