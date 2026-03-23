import React, { useState } from 'react';
import { X, Clipboard, AlertCircle, Plus } from 'lucide-react';

interface BulkImportModalProps {
  onClose: () => void;
  onImport: (domains: string[]) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onImport }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleImport = () => {
    if (!text.trim()) {
      setError('Please enter some domains.');
      return;
    }

    // Split by newline or comma
    const domains = text
      .split(/[\n,]+/)
      .map(d => d.trim())
      .filter(d => d.length > 0);

    if (domains.length === 0) {
      setError('No valid domains found.');
      return;
    }

    onImport(domains);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-zinc-900 rounded-2xl shadow-2xl max-w-xl w-full animate-in zoom-in-95 duration-200 border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Clipboard className="text-emerald-400" size={20} />
            <h2 className="text-lg font-semibold text-white">Bulk Import Domains</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-zinc-400 mb-4">
            Paste your domains below. You can separate them by <strong className="text-zinc-200">line breaks</strong> or <strong className="text-zinc-200">commas</strong>.
          </p>

          <textarea
            className="w-full h-48 px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:ring-2 focus:ring-emerald-500/30 outline-none text-sm font-mono resize-none transition-all text-zinc-200 placeholder:text-zinc-600"
            placeholder="google.com&#10;example.com, amazon.com&#10;github.com"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
          />

          {error && (
            <div className="mt-3 flex items-center gap-2 text-rose-600 text-xs font-medium animate-in slide-in-from-top-1">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-zinc-700 text-zinc-300 font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg shadow-md active:transform active:scale-95 transition-all flex items-center justify-center gap-2 shadow-emerald-500/20"
            >
              <Plus size={18} />
              Import Domains
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
