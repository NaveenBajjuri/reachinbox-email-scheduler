import React, { useState } from 'react';
import { Clock, Send, ChevronDown, LogOut } from 'lucide-react';
import type { User } from '../types/email';

interface SidebarProps {
  user: User;
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  onComposeClick: () => void;
  scheduledCount: number;
  sentCount: number;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  onComposeClick,
  scheduledCount,
  sentCount,
  onLogout,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const displayName = user.name || 'Oliver Brown';
  const displayEmail = user.email || 'oliver.brown@domain.io';

  return (
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col h-screen shrink-0 sticky top-0 select-none">
      {/* Top Brand Logo - ReachInbox Scheduler */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00A854] to-emerald-400 flex items-center justify-center text-white shadow-xs shadow-emerald-200 shrink-0">
            <Send className="w-4 h-4 -rotate-12 translate-x-0.5" />
          </div>
          <div>
            <span className="text-base font-black text-slate-900 tracking-tight leading-none block">
              ReachInbox
            </span>
            <span className="text-[10px] font-bold text-[#00A854] tracking-wider uppercase block mt-0.5">
              Scheduler
            </span>
          </div>
        </div>
      </div>

      {/* User Profile Card with Dropdown matching Figma */}
      <div className="px-4 mb-4 relative">
        <div
          onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all"
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm shrink-0">
                {displayName.charAt(0)}
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {displayEmail}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
        </div>

        {/* Dropdown Menu */}
        {profileDropdownOpen && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-50">
            <button
              onClick={() => {
                setProfileDropdownOpen(false);
                onLogout();
              }}
              className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Compose Action - Green Outlined Button matching Figma */}
      <div className="px-4 mb-6">
        <button
          onClick={onComposeClick}
          className="w-full py-2.5 px-4 rounded-xl border border-[#00A854] text-[#00A854] hover:bg-[#E8F5E9]/60 font-semibold text-xs tracking-wide transition-all flex items-center justify-center cursor-pointer shadow-xs active:scale-[0.99]"
        >
          <span>Compose</span>
        </button>
      </div>

      {/* CORE Navigation section matching Figma */}
      <div className="px-4 flex-1">
        <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-3 mb-2">
          CORE
        </p>

        <nav className="space-y-1">
          {/* Scheduled Tab */}
          <button
            onClick={() => onTabChange('scheduled')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'scheduled'
                ? 'bg-[#E8F5E9] text-[#00A854] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Scheduled</span>
            </div>
            <span
              className={`text-[11px] font-semibold ${
                activeTab === 'scheduled' ? 'text-[#00A854]' : 'text-slate-400'
              }`}
            >
              {scheduledCount}
            </span>
          </button>

          {/* Sent Tab */}
          <button
            onClick={() => onTabChange('sent')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'sent'
                ? 'bg-[#E8F5E9] text-[#00A854] font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3">
              <Send className="w-4 h-4 shrink-0" />
              <span>Sent</span>
            </div>
            <span
              className={`text-[11px] font-semibold ${
                activeTab === 'sent' ? 'text-[#00A854]' : 'text-slate-400'
              }`}
            >
              {sentCount}
            </span>
          </button>
        </nav>
      </div>
    </aside>
  );
};
