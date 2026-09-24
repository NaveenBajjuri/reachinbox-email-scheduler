import React, { useState, useEffect, useCallback } from 'react';
import type { User, Email, ScheduleEmailPayload } from './types/email';
import { api } from './lib/api';
import { Header } from './components/Header';
import { EmailTable } from './components/EmailTable';
import { ComposeModal } from './components/ComposeModal';
import { LoginView } from './components/LoginView';
import {
  Clock,
  Send,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Activity,
} from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Tab & Modal State
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  // Scheduled Data
  const [scheduledEmails, setScheduledEmails] = useState<Email[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [isScheduledLoading, setIsScheduledLoading] = useState(false);

  // Sent Data
  const [sentEmails, setSentEmails] = useState<Email[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(1);
  const [isSentLoading, setIsSentLoading] = useState(false);

  // Toast feedback state
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Check auth on initial mount
  const checkAuth = useCallback(async () => {
    setIsAuthLoading(true);
    try {
      const res = await api.auth.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      }
    } catch {
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Load Scheduled Emails
  const loadScheduled = useCallback(
    async (page: number = scheduledPage, showLoadingSpinner: boolean = true) => {
      if (!user) return;
      if (showLoadingSpinner) setIsScheduledLoading(true);
      try {
        const res = await api.emails.getScheduled(page, 15);
        setScheduledEmails(res.data);
        setScheduledTotal(res.total);
        setScheduledPage(res.page);
      } catch (err: any) {
        showToast(err.message || 'Failed to fetch scheduled emails', 'error');
      } finally {
        if (showLoadingSpinner) setIsScheduledLoading(false);
      }
    },
    [user, scheduledPage]
  );

  // Load Sent Emails
  const loadSent = useCallback(
    async (page: number = sentPage, showLoadingSpinner: boolean = true) => {
      if (!user) return;
      if (showLoadingSpinner) setIsSentLoading(true);
      try {
        const res = await api.emails.getSent(page, 15);
        setSentEmails(res.data);
        setSentTotal(res.total);
        setSentPage(res.page);
      } catch (err: any) {
        showToast(err.message || 'Failed to fetch sent emails', 'error');
      } finally {
        if (showLoadingSpinner) setIsSentLoading(false);
      }
    },
    [user, sentPage]
  );

  // Load data when tab or page changes
  useEffect(() => {
    if (user) {
      if (activeTab === 'scheduled') {
        loadScheduled(scheduledPage, true);
      } else {
        loadSent(sentPage, true);
      }
    }
  }, [user, activeTab, scheduledPage, sentPage, loadScheduled, loadSent]);

  // Periodic background refresh every 4s to track live job executions
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (activeTab === 'scheduled') {
        loadScheduled(scheduledPage, false);
      } else {
        loadSent(sentPage, false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [user, activeTab, scheduledPage, sentPage, loadScheduled, loadSent]);

  // Handlers
  const handleLogout = async () => {
    try {
      await api.auth.logout();
      setUser(null);
      showToast('Logged out successfully');
    } catch {
      setUser(null);
    }
  };

  const handleScheduleBatch = async (payload: ScheduleEmailPayload) => {
    const res = await api.emails.schedule(payload);
    showToast(
      `Successfully enqueued ${res.scheduledCount} email(s) into BullMQ delayed queue`,
      'success'
    );
    // Reload active tab
    loadScheduled(1, true);
  };

  const handleManualRefresh = () => {
    if (activeTab === 'scheduled') {
      loadScheduled(scheduledPage, true);
    } else {
      loadSent(sentPage, true);
    }
  };

  // Auth Loading Screen
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-medium">Connecting to ReachInbox scheduler...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return (
      <LoginView
        onLoginSuccess={(authedUser) => {
          setUser(authedUser);
          showToast(`Welcome back, ${authedUser.name}!`);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      {/* Navigation Header */}
      <Header user={user} onLogout={handleLogout} />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Toast Alert */}
        {toast && (
          <div
            className={`mb-6 p-4 rounded-2xl flex items-center space-x-3 text-sm shadow-sm transition-all border ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        {/* Dashboard Title & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Email Jobs & Queue Dashboard
            </h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span>Real-time BullMQ Delayed Scheduling &amp; Ethereal Delivery Engine</span>
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleManualRefresh}
              className="p-2.5 bg-white border border-slate-200 hover:border-slate-300 rounded-xl text-slate-600 hover:text-slate-900 shadow-xs transition-colors"
              title="Refresh Queue"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isScheduledLoading || isSentLoading ? 'animate-spin' : ''
                }`}
              />
            </button>
            <button
              onClick={() => setIsComposeOpen(true)}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Tabs Control */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`pb-3.5 px-4 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'scheduled'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Scheduled Emails</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-200/70 text-slate-600'
              }`}
            >
              {scheduledTotal}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3.5 px-4 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'sent'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Send className="w-4 h-4" />
            <span>Sent Emails</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'sent'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-200/70 text-slate-600'
              }`}
            >
              {sentTotal}
            </span>
          </button>
        </div>

        {/* Tables */}
        {activeTab === 'scheduled' ? (
          <EmailTable
            type="scheduled"
            emails={scheduledEmails}
            isLoading={isScheduledLoading}
            total={scheduledTotal}
            page={scheduledPage}
            pageSize={15}
            onPageChange={(newPage) => loadScheduled(newPage, true)}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        ) : (
          <EmailTable
            type="sent"
            emails={sentEmails}
            isLoading={isSentLoading}
            total={sentTotal}
            page={sentPage}
            pageSize={15}
            onPageChange={(newPage) => loadSent(newPage, true)}
          />
        )}
      </main>

      {/* Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSchedule={handleScheduleBatch}
        defaultSender={user.email}
      />
    </div>
  );
};

export default App;
