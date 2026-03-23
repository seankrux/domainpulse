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
    <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl text-white shadow-glow-emerald">
            <BarChart3 size={20} />
          </div>
          <h1 className="text-xl font-display font-bold text-white tracking-tight" data-testid="header-title">
            Domain<span className="text-emerald-400">Pulse</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-zinc-500">
            {settings.autoRefresh && (
              <>
                <Clock size={14} />
                <span>Auto-refresh: {REFRESH_INTERVALS.find(i => i.value === settings.refreshInterval)?.label}</span>
              </>
            )}
          </div>
          <button
            onClick={toggleDarkMode}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-2 rounded-lg hover:bg-zinc-800/50"
            title="Toggle dark mode"
          >
            {settings.darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            data-testid="settings-button"
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
            title="Settings"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={logout}
            className="text-zinc-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-zinc-800/50"
            title="Sign out"
          >
            <LogOut size={20} />
          </button>
          <a
            href={typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL ? import.meta.env.VITE_SITE_URL : 'http://localhost:3002'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-500 hover:text-emerald-400 transition-colors flex items-center gap-1.5 text-sm font-medium p-2 rounded-lg hover:bg-zinc-800/50"
            title="View Website"
          >
            <span className="hidden lg:inline">Website</span>
            <ArrowRight size={16} />
          </a>
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-zinc-800 cursor-pointer" title="Sean G">
            SG
          </div>
        </div>
      </div>
    </header>
  );
};
