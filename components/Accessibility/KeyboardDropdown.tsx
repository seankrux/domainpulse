import React, { useState, useCallback, useRef, useEffect, ReactNode } from 'react';

interface KeyboardDropdownProps {
  trigger: ReactNode;
  items: Array<{
    id: string;
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    color?: string;
  }>;
  title?: string;
}

/**
 * Accessible dropdown with full keyboard navigation support.
 * Supports: Arrow keys, Enter, Space, Escape, Tab
 */
export const KeyboardDropdown: React.FC<KeyboardDropdownProps> = ({
  trigger,
  items,
  title
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const openDropdown = useCallback(() => {
    setIsOpen(true);
    setSelectedIndex(0);
  }, []);

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSelectedIndex(-1);
    triggerRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Home':
        e.preventDefault();
        setSelectedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setSelectedIndex(items.length - 1);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          items[selectedIndex].onClick();
          closeDropdown();
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
      case 'Tab':
        closeDropdown();
        break;
    }
  }, [isOpen, selectedIndex, items, closeDropdown, openDropdown]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeDropdown]);

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        onClick={() => isOpen ? closeDropdown() : openDropdown()}
        className="focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={title || 'Open menu'}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          className="absolute bottom-full mb-2 left-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 min-w-[160px] z-50 animate-in fade-in zoom-in-95 origin-bottom"
          role="menu"
          aria-orientation="vertical"
        >
          {title && (
            <p className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider" role="presentation">
              {title}
            </p>
          )}
          {items.map((item, index) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeDropdown();
              }}
              className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-2 focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-700 ${
                index === selectedIndex
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
              role="menuitem"
              aria-selected={index === selectedIndex}
              tabIndex={-1}
            >
              {item.color && (
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
              )}
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
