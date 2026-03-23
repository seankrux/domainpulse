import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ArrowRight, Shield } from 'lucide-react';

interface LoginPageProps {
  onLogin: (password: string) => Promise<boolean>;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const success = await onLogin(password);
    
    if (!success) {
      setError('Invalid password. Please try again.');
      setPassword('');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/30 mb-4">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Domain<span className="text-emerald-400">Pulse</span>
          </h1>
          <p className="text-zinc-400">Sign in to access your dashboard</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-zinc-800 p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Lock size={20} className="text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">Enter Password</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 bg-white/5 border border-zinc-700 rounded-xl text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
                  <span>{error}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-white py-3 rounded-xl font-medium transition-all shadow-lg shadow-emerald-500/30 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-6 pt-6 border-t border-zinc-800/50">
            <div className="bg-emerald-500/5 backdrop-blur-sm border border-emerald-500/10 rounded-xl px-4 py-3">
              <p className="text-[11px] text-emerald-400/80 text-center font-medium tracking-wide uppercase mb-1">Demo Mode</p>
              <p className="text-xs text-zinc-500 text-center leading-relaxed">
                Enter any password to explore the dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-sm mt-8">
          DomainPulse — Real-time domain monitoring
        </p>
      </div>
    </div>
  );
};
