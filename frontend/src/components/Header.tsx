import React from 'react';
import type { User } from '../types/email';
import { Mail, LogOut, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg text-slate-900 tracking-tight">ReachInbox</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full border border-indigo-200">
                Scheduler
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Production BullMQ + Redis Engine</p>
          </div>
        </div>

        {/* User Profile & Actions */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-9 h-9 rounded-full ring-2 ring-indigo-500/20 object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center text-sm font-semibold">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden md:block text-left">
              <div className="text-sm font-semibold text-slate-800 flex items-center space-x-1">
                <span>{user.name}</span>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-xs text-slate-500">{user.email}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 hover:border-rose-200"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
