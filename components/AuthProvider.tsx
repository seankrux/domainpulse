import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthState } from '../types';

const AUTH_TOKEN_KEY = 'domainpulse_auth_token';
const PASSWORD_HASH_KEY = 'domainpulse_password_hash';

// Simple hash function for password verification (client-side only)
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      const storedHash = localStorage.getItem(PASSWORD_HASH_KEY);
      
      if (storedToken && storedHash && storedToken === storedHash) {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const passwordHash = await hashPassword(password);
      const envPasswordHash = import.meta.env.VITE_PASSWORD_HASH;
      
      // Check against environment variable first (production)
      // Then fall back to localStorage (development)
      const validHash = envPasswordHash || localStorage.getItem(PASSWORD_HASH_KEY);
      
      if (!validHash) {
        // No password set - allow login and store the hash
        localStorage.setItem(PASSWORD_HASH_KEY, passwordHash);
        localStorage.setItem(AUTH_TOKEN_KEY, passwordHash);
        setIsAuthenticated(true);
        return true;
      }
      
      if (passwordHash === validHash) {
        localStorage.setItem(AUTH_TOKEN_KEY, passwordHash);
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
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
