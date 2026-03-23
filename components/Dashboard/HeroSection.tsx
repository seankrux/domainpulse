import React from 'react';
import { Plus, AlertCircle } from 'lucide-react';

interface HeroSectionProps {
  domainCount: number;
  newDomainUrl: string;
  setNewDomainUrl: (url: string) => void;
  inputError: string | null;
  setInputError: (error: string | null) => void;
  onAddDomain: (url: string) => void;
  onShowBulkImport: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  domainCount,
  newDomainUrl,
  setNewDomainUrl,
  inputError,
  setInputError,
  onAddDomain,
  onShowBulkImport
}) => {
  return (
    <div className={`mb-10 max-w-2xl mx-auto transition-all duration-500 ${domainCount > 0 ? 'scale-95' : 'scale-100'}`}>
      <div className={`text-center mb-6 transition-all duration-500 ${domainCount > 0 ? 'opacity-50 h-0 overflow-hidden mb-0' : 'opacity-100'}`}>
        <h2 className="text-3xl font-display font-bold text-white mb-2">Monitor your digital assets</h2>
        <p className="text-zinc-400 text-lg">Real-time uptime monitoring and latency tracking.</p>
      </div>

      <div className="relative group z-10">
        <div className={`absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200 ${inputError ? 'from-red-500 to-rose-500 opacity-40' : ''}`}></div>
        <div className="relative flex items-center bg-zinc-900/90 backdrop-blur-md rounded-xl shadow-lg border border-zinc-800 p-2">
          <div className="pl-4 text-zinc-500">
            <Plus size={20} />
          </div>
          <input
            type="text"
            placeholder="Enter domain to monitor (e.g., google.com)"
            className="flex-1 px-4 py-3 text-lg bg-transparent border-none focus:ring-0 text-white placeholder:text-zinc-600 font-medium"
            value={newDomainUrl}
            onChange={(e) => {
              setNewDomainUrl(e.target.value);
              if (inputError) setInputError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && onAddDomain(newDomainUrl)}
          />
          <div className="flex items-center gap-1.5 mr-1">
            <button
              onClick={onShowBulkImport}
              className="text-zinc-500 hover:text-emerald-400 px-3 py-2 text-sm font-medium transition-colors"
              title="Bulk Import"
            >
              Bulk
            </button>
            <button
              onClick={() => onAddDomain(newDomainUrl)}
              className="bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-md active:transform active:scale-95 shadow-emerald-500/20"
            >
              Track
            </button>
          </div>
        </div>
        {inputError && (
          <div className="absolute top-full left-0 mt-2 flex items-center gap-2 text-red-400 text-sm font-medium animate-in slide-in-from-top-2">
            <AlertCircle size={14} />
            {inputError}
          </div>
        )}
      </div>
    </div>
  );
};
