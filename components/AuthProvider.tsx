import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthState } from '../types';

const AUTH_TOKEN_KEY = 'domainpulse_auth_token';
const PASSWORD_HASH_KEY = 'domainpulse_password_hash';
const PASSWORD_SALT_KEY = 'domainpulse_password_salt';

// Generate a random salt for password hashing
const generateSalt = (): string => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
};

// Secure password hashing using PBKDF2 with salt (client-side only)
const hashPassword = async (password: string, salt?: string): Promise<{ hash: string; salt: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const usedSalt = salt || generateSalt();
  const saltBuffer = encoder.encode(usedSalt);
  
  // Use PBKDF2 with 100,000 iterations for better security
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    data,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return { hash, salt: usedSalt };
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

      if (storedToken && storedHash) {
        setIsAuthenticated(true);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = useCallback(async (password: string): Promise<boolean> => {
    try {
      const envPasswordHash = import.meta.env.VITE_PASSWORD_HASH;
      const storedSalt = localStorage.getItem(PASSWORD_SALT_KEY);

      // Check against environment variable first (production)
      if (envPasswordHash) {
        // Environment variable format: hash:salt
        const [envHash, envSalt] = envPasswordHash.split(':');
        if (!envSalt) {
          console.error('VITE_PASSWORD_HASH must be in format hash:salt');
          return false;
        }
        const result = await hashPassword(password, envSalt);
        if (result.hash === envHash) {
          localStorage.setItem(AUTH_TOKEN_KEY, result.hash);
          localStorage.setItem(PASSWORD_HASH_KEY, result.hash);
          localStorage.setItem(PASSWORD_SALT_KEY, result.salt);
          setIsAuthenticated(true);
          return true;
        }
        return false;
      }

      // Development: fall back to localStorage
      const validHash = localStorage.getItem(PASSWORD_HASH_KEY);

      if (!validHash) {
        // No password set - allow login and store the hash with salt
        const result = await hashPassword(password);
        localStorage.setItem(PASSWORD_HASH_KEY, result.hash);
        localStorage.setItem(PASSWORD_SALT_KEY, result.salt);
        localStorage.setItem(AUTH_TOKEN_KEY, result.hash);
        setIsAuthenticated(true);
        return true;
      }

      const result = await hashPassword(password, storedSalt || undefined);
      if (result.hash === validHash) {
        localStorage.setItem(AUTH_TOKEN_KEY, result.hash);
        localStorage.setItem(PASSWORD_SALT_KEY, result.salt);
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
