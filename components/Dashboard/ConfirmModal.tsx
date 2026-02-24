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
      const announcement = `${title}. ${message}`;
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('role', 'alert');
      liveRegion.setAttribute('aria-live', 'assertive');
      liveRegion.setAttribute('class', 'sr-only');
      liveRegion.textContent = announcement;
      document.body.appendChild(liveRegion);

      return () => {
        document.body.removeChild(liveRegion);
      };
    }
  }, [isOpen, title, message]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-100 dark:border-rose-800',
      button: 'bg-rose-600 hover:bg-rose-700'
    },
    warning: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-100 dark:border-amber-800',
      button: 'bg-amber-600 hover:bg-amber-700'
    },
    info: {
      bg: 'bg-indigo-50 dark:bg-indigo-900/20',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-100 dark:border-indigo-800',
      button: 'bg-indigo-600 hover:bg-indigo-700'
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
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between ${style.bg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${style.bg} ${style.text} border ${style.border}`}>
              <AlertTriangle size={20} />
            </div>
            <h2 id="confirm-title" className="text-lg font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close confirmation dialog"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p id="confirm-description" className="text-sm text-slate-600 dark:text-slate-300 mb-6">
            {message}
          </p>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 px-6 py-2.5 ${style.button} text-white font-bold rounded-xl transition-all text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${variant === 'danger' ? 'focus:ring-rose-500' : variant === 'warning' ? 'focus:ring-amber-500' : 'focus:ring-indigo-500'}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
