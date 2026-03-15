import React from 'react';
import { Settings, X, RefreshCw, Trash2, Plus, Bell, Link } from 'lucide-react';
import { AppSettings } from '../../utils/storage';
import { WebhookConfig } from '../../types';

interface SettingsPanelProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onClose: () => void;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  showInfo: (msg: string) => void;
  requestNotificationPermission: () => Promise<boolean>;
}

const REFRESH_INTERVALS = [
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
  { label: '5 minutes', value: 300000 },
  { label: '15 minutes', value: 900000 },
  { label: '30 minutes', value: 1800000 },
];

const clampNumber = (value: number, min: number, max: number): number => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
};

const isValidWebhookUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  setSettings,
  onClose,
  showSuccess,
  showError,
  showInfo,
  requestNotificationPermission
}) => {
  const [newWebhook, setNewWebhook] = React.useState<WebhookConfig>({ id: '', name: '', url: '', type: 'slack', enabled: true });

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

  const addWebhook = () => {
    if (!newWebhook.name || !newWebhook.url) return;
    if (!isValidWebhookUrl(newWebhook.url)) {
      showError('Webhook URL must be a valid https:// or http:// URL.');
      return;
    }

    const webhook: WebhookConfig = {
      id: Math.random().toString(36).substr(2, 9),
      name: newWebhook.name,
      url: newWebhook.url,
      type: newWebhook.type,
      enabled: true
    };
    setSettings(prev => ({
      ...prev,
      webhooks: [...(prev.webhooks || []), webhook]
    }));
    setNewWebhook({ id: '', name: '', url: '', type: 'slack', enabled: true });
    showSuccess('Webhook added');
  };

  const removeWebhook = (id: string) => {
    setSettings(prev => ({
      ...prev,
      webhooks: prev.webhooks.filter(w => w.id !== id)
    }));
    showInfo('Webhook removed');
  };

  const toggleWebhook = (id: string) => {
    setSettings(prev => ({
      ...prev,
      webhooks: prev.webhooks.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w)
    }));
  };

  return (
    <div data-testid="settings-panel" className="mb-8 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-6 animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings size={20} />
          Settings
        </h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <X size={20} />
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* General Settings */}
        <div className="space-y-6">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">General</h4>
          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoRefresh}
                onChange={toggleAutoRefresh}
                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="font-medium text-slate-700 dark:text-slate-200">Auto-refresh</span>
                <p className="text-xs text-slate-500 dark:text-slate-400">Check domains at set intervals</p>
              </div>
            </label>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Refresh Interval</label>
              <select
                value={settings.refreshInterval}
                onChange={(e) => updateRefreshInterval(Number(e.target.value))}
                disabled={!settings.autoRefresh}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50 text-sm"
              >
                {REFRESH_INTERVALS.map(interval => (
                  <option key={interval.value} value={interval.value}>{interval.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                <span className="text-sm font-medium">Notifications</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.playSound}
                  onChange={(e) => setSettings(prev => ({ ...prev, playSound: e.target.checked }))}
                  disabled={!settings.enableNotifications}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span className="text-sm font-medium">Sound</span>
              </label>
            </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">History Retention</label>
                                <select
                                  value={settings.maxHistoryRecords}
                                  onChange={(e) => setSettings(prev => ({ ...prev, maxHistoryRecords: clampNumber(Number(e.target.value), 50, 1000) }))}
                                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                >
                                  <option value={50}>50 records</option>
                                  <option value={100}>100 records</option>
                                  <option value={500}>500 records</option>
                                  <option value={1000}>1000 records</option>
                                </select>
                              </div>
            
                              <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 mt-8 pt-4 border-t border-slate-100 dark:border-slate-700">Advanced Monitoring</h4>
                              
                              <div className="space-y-4">
                                <div>
                                  <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Custom User-Agent</label>
                                  <input
                                    type="text"
                                    value={settings.customUserAgent}
                                    onChange={(e) => setSettings(prev => ({ ...prev, customUserAgent: e.target.value.trim() }))}
                                    placeholder="DomainPulse/1.0"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                                  />
                                </div>
            
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Timeout (ms)</label>
                                    <input
                                      type="number"
                                      value={settings.checkTimeout}
                                      min={1000}
                                      max={120000}
                                      onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        checkTimeout: clampNumber(Number(e.target.value), 1000, 120000)
                                      }))}
                                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Latency Alert (ms)</label>
                                    <input
                                      type="number"
                                      value={settings.latencyThreshold}
                                      min={50}
                                      max={10000}
                                      onChange={(e) => setSettings(prev => ({
                                        ...prev,
                                        latencyThreshold: clampNumber(Number(e.target.value), 50, 10000)
                                      }))}
                                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                    {/* Webhooks Settings */}
        <div className="space-y-6">
          <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Webhooks (Slack / Discord)</h4>
          
          <div className="space-y-4">
            {/* Webhook List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {(!settings.webhooks || settings.webhooks.length === 0) ? (
                <div className="text-center py-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-600">
                  <p className="text-xs text-slate-500">No webhooks configured</p>
                </div>
              ) : (
                settings.webhooks.map(webhook => (
                  <div key={webhook.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600 group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={`p-2 rounded-lg ${webhook.enabled ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-slate-200 dark:bg-slate-600 text-slate-400'}`}>
                        <Bell size={14} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-semibold truncate">{webhook.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate uppercase">{webhook.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleWebhook(webhook.id)}
                        className={`p-1.5 rounded-md transition-colors ${webhook.enabled ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                        title={webhook.enabled ? 'Disable' : 'Enable'}
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button 
                        onClick={() => removeWebhook(webhook.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-md transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Webhook Form */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-600 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Name (e.g. Alerts)"
                  value={newWebhook.name}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <select
                  value={newWebhook.type}
                  onChange={(e) => setNewWebhook(prev => ({ ...prev, type: e.target.value as 'slack' | 'discord' }))}
                  className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="slack">Slack</option>
                  <option value="discord">Discord</option>
                </select>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input
                    type="text"
                    placeholder="Webhook URL"
                    value={newWebhook.url}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <button
                  onClick={addWebhook}
                  disabled={!newWebhook.name || !newWebhook.url}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg disabled:opacity-50 transition-colors"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
