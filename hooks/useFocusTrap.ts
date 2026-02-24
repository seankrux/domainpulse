import { useEffect, useRef, useCallback } from 'react';

interface UseFocusTrapOptions {
  enabled?: boolean;
  initialFocus?: string;
  onEscape?: () => void;
}

/**
 * Custom hook to trap focus within a container element.
 * Essential for accessible modals and dialogs.
 */
export function useFocusTrap({
  enabled = true,
  initialFocus,
  onEscape
}: UseFocusTrapOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled || !containerRef.current) return;

    // Handle Escape key
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }

    // Handle Tab key - trap focus
    if (e.key === 'Tab') {
      const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: Move focus backward
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: Move focus forward
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }
  }, [enabled, onEscape]);

  useEffect(() => {
    if (!enabled) return;

    // Store previous focus
    previousActiveElement.current = document.activeElement;

    // Add keydown listener
    document.addEventListener('keydown', handleKeyDown);

    // Focus initial element
    if (initialFocus && containerRef.current) {
      const element = containerRef.current.querySelector(initialFocus);
      if (element) {
        element.focus();
      } else {
        // Focus first focusable element
        const firstFocusable = containerRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      // Restore previous focus
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [enabled, initialFocus, handleKeyDown]);

  return containerRef;
}
