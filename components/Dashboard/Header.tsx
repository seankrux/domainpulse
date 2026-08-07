import React from 'react';
import { BarChart3, Settings, ArrowRight, Clock } from 'lucide-react';
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
  showSettings,
  setShowSettings,
}) => {
  return (
    <header className="bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/80 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl text-white shadow-glow-emerald" aria-hidden="true">
            <BarChart3 size={20} />
          </div>
          <h1 className="text-xl font-display font-bold text-white tracking-tight" data-testid="header-title">
            Domain<span className="text-emerald-400">Pulse</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 text-sm text-zinc-400">
            {settings.autoRefresh ? (
              <>
                <Clock size={14} aria-hidden="true" />
                <span>Auto-refresh: {REFRESH_INTERVALS.find(i => i.value === settings.refreshInterval)?.label}</span>
              </>
            ) : (
              <span className="text-zinc-500">Auto-refresh off</span>
            )}
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            data-testid="settings-button"
            aria-label={showSettings ? 'Close settings' : 'Open settings'}
            aria-expanded={showSettings}
            className={`p-2 rounded-lg transition-colors ${showSettings ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'}`}
          >
            <Settings size={20} />
          </button>
          <a
            href={typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL ? import.meta.env.VITE_SITE_URL : 'http://localhost:3002'}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View marketing website"
            className="text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-1.5 text-sm font-medium p-2 rounded-lg hover:bg-zinc-800/50"
          >
            <span className="hidden lg:inline">Website</span>
            <ArrowRight size={16} aria-hidden="true" />
          </a>
          <div
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-zinc-800"
            aria-hidden="true"
          >
            SG
          </div>
        </div>
      </div>
    </header>
  );
};
