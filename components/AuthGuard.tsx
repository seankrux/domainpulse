import React, { ReactNode, useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { LoginPage } from './LoginPage';
import { logger } from '../utils/logger';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * Gates the dashboard behind the login portal — but only when the deployment
 * is actually password-protected. `/api/auth-status` says whether a password
 * is configured (VITE_PASSWORD_HASH); without one the app stays a login-less
 * public demo, matching the opt-in API auth (AGENTS.md §7).
 *
 * If the status probe fails we fall open to public mode rather than brick the
 * app; a protected API still rejects every call (401 → `auth-invalid` event),
 * which re-triggers the probe below and lands the user on the login page.
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);

  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth-status');
      if (!response.ok) throw new Error(`auth-status ${response.status}`);
      const data = await response.json();
      setAuthRequired(Boolean(data.authRequired));
    } catch (error) {
      logger.error('Auth status check failed, assuming public mode:', error);
      setAuthRequired(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  useEffect(() => {
    // A 401 from any API call clears the session (AuthProvider) — re-probe so
    // a protected instance shows the login page instead of a broken dashboard.
    const handleAuthInvalid = () => {
      checkAuthStatus();
    };
    window.addEventListener('domainpulse:auth-invalid', handleAuthInvalid);
    return () => window.removeEventListener('domainpulse:auth-invalid', handleAuthInvalid);
  }, [checkAuthStatus]);

  if (authRequired === null || isLoading) {
    return (
      <div
        className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex flex-col items-center justify-center gap-4"
        data-testid="auth-loading"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl shadow-lg shadow-emerald-500/10">
          <Lock size={28} className="text-emerald-400" aria-hidden="true" />
        </div>
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-sm text-zinc-500">Checking access…</p>
      </div>
    );
  }

  if (authRequired && !isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return <>{children}</>;
};
