import React, { useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning'
}) => {
  const modalContentRef = useFocusTrap({
    enabled: isOpen,
    onEscape: onClose
  });

  useEffect(() => {
    if (isOpen) {
      let liveRegion = document.getElementById('domainpulse-aria-live-region');
      if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'domainpulse-aria-live-region';
        liveRegion.setAttribute('role', 'alert');
        liveRegion.setAttribute('aria-live', 'assertive');
        liveRegion.setAttribute('class', 'sr-only');
        document.body.appendChild(liveRegion);
      }
      liveRegion.textContent = `${title}. ${message}`;
    }
  }, [isOpen, title, message]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      bg: 'bg-red-500/10',
      text: 'text-red-400',
      border: 'border-red-500/20',
      button: 'bg-red-500 hover:bg-red-400'
    },
    warning: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      button: 'bg-amber-500 hover:bg-amber-400'
    },
    info: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
      button: 'bg-emerald-500 hover:bg-emerald-400'
    }
  };

  const style = variantStyles[variant];

  return (
    <div
      data-testid="confirm-modal"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={modalContentRef}
        className="bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b border-zinc-800 flex items-center justify-between ${style.bg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.bg} ${style.text} border ${style.border}`}>
              <AlertTriangle size={20} />
            </div>
            <h2 id="confirm-title" className="text-lg font-bold text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Close confirmation dialog"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p id="confirm-description" className="text-sm text-zinc-300 mb-6">
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold rounded-xl hover:bg-zinc-800 transition-all text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-6 py-2.5 ${style.button} text-white font-bold rounded-xl transition-all text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${variant === 'danger' ? 'focus:ring-rose-500' : variant === 'warning' ? 'focus:ring-amber-500' : 'focus:ring-emerald-500'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
