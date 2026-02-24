import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthState } from '../types';
import { config } from '../lib/config';

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

const readSession = (): StoredSession | null => {
  const storedSession = localStorage.getItem(AUTH_SESSION_KEY);
  if (!storedSession) {
    return null;
  }

  try {
    const parsed = JSON.parse(storedSession) as StoredSession;
    if (!parsed.token || !parsed.expiresAt) {
      return null;
    }

    if (parsed.expiresAt <= getNow()) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    localStorage.removeItem(AUTH_SESSION_KEY);
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

  useEffect(() => {
    const syncStorage = (event: StorageEvent) => {
      if (event.key === AUTH_SESSION_KEY && event.newValue === null) {
        clearSession();
      }
    };

    window.addEventListener('storage', syncStorage);
    return () => window.removeEventListener('storage', syncStorage);
  }, [clearSession]);

  const saveSession = (token: string, expiresAt: number) => {
    const safeExpiresAt = expiresAt > getNow() ? expiresAt : getNow() + SESSION_TTL_MS;
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token, expiresAt: safeExpiresAt }));
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
