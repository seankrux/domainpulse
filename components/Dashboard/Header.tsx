import React from 'react';
import { BarChart3, Sun, Moon, Settings, LogOut, ArrowRight, Clock } from 'lucide-react';
import { AppSettings } from '../../utils/storage';

interface HeaderProps {
  settings: AppSettings;
  toggleDarkMode: () => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  logout: () => void;
}

const REFRESH_INTERVALS = [
  { label: '30 seconds', value: 30000 },
  { label: '1 minute', value: 60000 },
  { label: '5 minutes', value: 300000 },
  { label: '15 minutes', value: 900000 },
  { label: '30 minutes', value: 1800000 },
];

export const Header: React.FC<HeaderProps> = ({
  settings,
  toggleDarkMode,
  showSettings,
  setShowSettings,
  logout
}) => {
  return (
    <header className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-glow">
            <BarChart3 size={20} />
          </div>
          <h1 className="text-xl font-display font-bold text-slate-900 dark:text-white tracking-tight" data-testid="header-title">
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
            data-testid="settings-button"
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
            href={typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL ? import.meta.env.VITE_SITE_URL : 'http://localhost:3002'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5 text-sm font-medium"
            title="View Website"
          >
            <span className="hidden lg:inline">Website</span>
            <ArrowRight size={16} />
          </a>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white cursor-pointer" title="Sean G">
            SG
          </div>
        </div>
      </div>
    </header>
  );
};
