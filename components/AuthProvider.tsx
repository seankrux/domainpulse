import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AuthState } from '../types';
import { config } from '../lib/config';

// Use sessionStorage instead of localStorage for better security (cleared on browser close)
const AUTH_SESSION_KEY = 'domainpulse_auth_session';
const SESSION_TTL_MS = config.auth.sessionTTL;

interface StoredSession {
  token: string;
  expiresAt: number;
}

interface AuthContextType extends AuthState {}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const getNow = () => Date.now();

// Use ref to store session in memory (not accessible to XSS via localStorage)
let inMemorySession: StoredSession | null = null;

const readSession = (): StoredSession | null => {
  // First check in-memory session
  if (inMemorySession && inMemorySession.token && inMemorySession.expiresAt > getNow()) {
    return inMemorySession;
  }
  
  // Fallback to sessionStorage for persistence across page reloads
  // Note: sessionStorage is still vulnerable to XSS but cleared when browser/tab closes
  const storedSession = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!storedSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedSession) as StoredSession;
    if (!parsed.token || !parsed.expiresAt) {
      return null;
    }

    if (parsed.expiresAt <= getNow()) {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      inMemorySession = null;
      return null;
    }

    // Cache in memory
    inMemorySession = parsed;
    return parsed;
  } catch {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    inMemorySession = null;
    return null;
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    inMemorySession = null;
    setIsAuthenticated(false);
  }, []);

  const checkAuth = useCallback(() => {
    const session = readSession();
    setIsAuthenticated(Boolean(session));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const handleAuthInvalid = () => {
      clearSession();
    };

    window.addEventListener('domainpulse:auth-invalid', handleAuthInvalid);
    return () => window.removeEventListener('domainpulse:auth-invalid', handleAuthInvalid);
  }, [clearSession]);

  // Note: Removed storage event listener since sessionStorage is tab-specific
  // and inMemorySession is module-scoped

  const saveSession = (token: string, expiresAt: number) => {
    const safeExpiresAt = expiresAt > getNow() ? expiresAt : getNow() + SESSION_TTL_MS;
    // Store in memory first (not accessible via XSS)
    inMemorySession = { token, expiresAt: safeExpiresAt };
    // Also store in sessionStorage for page reload persistence
    // Warning: sessionStorage is still vulnerable to XSS but cleared on browser/tab close
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token, expiresAt: safeExpiresAt }));
  };

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (response.ok) {
        const data = await response.json();
        saveSession(data.token, Number(data.expiresAt) || getNow() + SESSION_TTL_MS);
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
