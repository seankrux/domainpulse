import React, { useState, useCallback } from 'react';

interface UseAnnounceReturn {
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  Announcer: () => JSX.Element;
}

export function useAnnounce(): UseAnnounceReturn {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');

  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    // Clear message first to trigger announcement
    if (priority === 'assertive') {
      setAssertiveMessage('');
      setTimeout(() => setAssertiveMessage(message), 100);
    } else {
      setPoliteMessage('');
      setTimeout(() => setPoliteMessage(message), 100);
    }
  }, []);

  const Announcer = useCallback(() => (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </>
  ), [politeMessage, assertiveMessage]);

  return { announce, Announcer };
}
