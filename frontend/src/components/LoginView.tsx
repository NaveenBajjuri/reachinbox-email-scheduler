import React, { useState } from 'react';
import { Mail, Shield, Zap, RefreshCw, ArrowRight } from 'lucide-react';
import type { User } from '../types/email';
import { api } from '../lib/api';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [devEmail, setDevEmail] = useState('demo-evaluator@reachinbox.ai');
  const [devName, setDevName] = useState('Naveen Bajjuri');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = () => {
    // Direct browser redirect to Google OAuth flow
    window.location.href = '/api/auth/google';
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.auth.devLogin(devEmail, devName);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 mb-4">
          <Mail className="w-7 h-7" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          ReachInbox Scheduler
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Production-grade distributed job queue & email engine
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-100 sm:rounded-3xl sm:px-10 border border-slate-200">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
              {error}
            </div>
          )}

          {/* Primary Action: Google OAuth */}
          <div>
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center space-x-3 py-3 px-4 border border-slate-200 rounded-2xl shadow-xs bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-slate-400 font-semibold">Or quick evaluation</span>
            </div>
          </div>

          {/* Quick Dev Login */}
          <form onSubmit={handleDevLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Evaluator Name</label>
              <input
                type="text"
                required
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <span>{isLoading ? 'Signing In...' : 'Launch Dashboard Session'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Architecture badges */}
          <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-slate-50 rounded-xl">
              <Zap className="w-4 h-4 text-amber-500 mx-auto mb-1" />
              <div className="text-[10px] font-semibold text-slate-700">BullMQ + Redis</div>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <Shield className="w-4 h-4 text-indigo-500 mx-auto mb-1" />
              <div className="text-[10px] font-semibold text-slate-700">Idempotency</div>
            </div>
            <div className="p-2 bg-slate-50 rounded-xl">
              <RefreshCw className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
              <div className="text-[10px] font-semibold text-slate-700">Zero Cron</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
