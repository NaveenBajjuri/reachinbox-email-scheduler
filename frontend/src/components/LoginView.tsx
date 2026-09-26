import React, { useState } from 'react';
import type { User } from '../types/email';
import { api } from '../lib/api';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('oliver.brown@domain.io');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please enter your email ID');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const derivedName = email.split('@')[0].replace(/[._-]/g, ' ') || 'Demo User';
      const formattedName = derivedName
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const res = await api.auth.devLogin(email.trim(), formattedName);
      if (res.success && res.user) {
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center items-center px-4 sm:px-6">
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-8 sm:p-10">
        <h1 className="text-2xl font-bold text-center text-slate-900 mb-8">Login</h1>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {error}
          </div>
        )}

        {/* Google OAuth Button - Figma style with soft green background */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center space-x-2.5 py-3 px-4 bg-[#E8F5E9] hover:bg-[#D4EDDA] border border-[#C3E6CB] rounded-xl text-xs font-semibold text-slate-800 transition-all cursor-pointer shadow-xs"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
          <span>Login with Google</span>
        </button>

        {/* Divider */}
        <div className="relative my-7">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="bg-white px-3 text-slate-400 font-normal">
              or sign up through email
            </span>
          </div>
        </div>

        {/* Email / Password Form matching Figma */}
        <form onSubmit={handleEmailLogin} className="space-y-3.5">
          <div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email ID"
              className="w-full px-4 py-3 bg-[#F4F5F7] border border-transparent hover:border-slate-300 focus:border-[#00A854] focus:bg-white rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 bg-[#F4F5F7] border border-transparent hover:border-slate-300 focus:border-[#00A854] focus:bg-white rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 px-4 bg-[#00A854] hover:bg-[#009249] active:bg-[#007E3D] text-white rounded-xl text-xs font-semibold tracking-wide transition-all shadow-sm cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};
