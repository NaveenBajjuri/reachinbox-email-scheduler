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
} from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);

  const [scheduled, setScheduled] = useState<Email[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  const [sent, setSent] = useState<Email[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(1);
  const [sentLoading, setSentLoading] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const notify = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const verifySession = useCallback(async () => {
    setAuthLoading(true);
    try {
      const res = await api.auth.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession]);

  const fetchScheduled = useCallback(
    async (page: number = scheduledPage, showSpinner: boolean = true) => {
      if (!user) return;
      if (showSpinner) setScheduledLoading(true);
      try {
        const res = await api.emails.getScheduled(page, 15);
        setScheduled(res.data);
        setScheduledTotal(res.total);
        setScheduledPage(res.page);
      } catch (err: any) {
        notify(err.message || 'Failed to fetch scheduled emails', 'error');
      } finally {
        if (showSpinner) setScheduledLoading(false);
      }
    },
    [user, scheduledPage]
  );

  const fetchSent = useCallback(
    async (page: number = sentPage, showSpinner: boolean = true) => {
      if (!user) return;
      if (showSpinner) setSentLoading(true);
      try {
        const res = await api.emails.getSent(page, 15);
        setSent(res.data);
        setSentTotal(res.total);
        setSentPage(res.page);
      } catch (err: any) {
        notify(err.message || 'Failed to fetch sent emails', 'error');
      } finally {
        if (showSpinner) setSentLoading(false);
      }
    },
    [user, sentPage]
  );

  useEffect(() => {
    if (user) {
      if (activeTab === 'scheduled') {
        fetchScheduled(scheduledPage, true);
      } else {
        fetchSent(sentPage, true);
      }
    }
  }, [user, activeTab, scheduledPage, sentPage, fetchScheduled, fetchSent]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (activeTab === 'scheduled') {
        fetchScheduled(scheduledPage, false);
      } else {
        fetchSent(sentPage, false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [user, activeTab, scheduledPage, sentPage, fetchScheduled, fetchSent]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
      setUser(null);
      notify('Logged out');
    } catch {
      setUser(null);
    }
  };

  const handleScheduleBatch = async (payload: ScheduleEmailPayload) => {
    const res = await api.emails.schedule(payload);
    notify(`Scheduled ${res.scheduledCount} email(s) successfully`, 'success');
    fetchScheduled(1, true);
  };

  const handleRefresh = () => {
    if (activeTab === 'scheduled') {
      fetchScheduled(scheduledPage, true);
    } else {
      fetchSent(sentPage, true);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginView
        onLoginSuccess={(authedUser) => {
          setUser(authedUser);
          notify(`Welcome ${authedUser.name}`);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <Header user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {toast && (
          <div
            className={`mb-6 p-4 rounded-xl flex items-center space-x-3 text-sm border shadow-xs ${
              toast.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium text-xs">{toast.message}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Email Scheduler Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">BullMQ &amp; Redis queue monitoring</p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={handleRefresh}
              className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              title="Refresh"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  scheduledLoading || sentLoading ? 'animate-spin' : ''
                }`}
              />
            </button>
            <button
              onClick={() => setComposeOpen(true)}
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-200 mb-6">
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'scheduled'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled Emails</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
              {scheduledTotal}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'sent'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Sent Emails</span>
            <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600">
              {sentTotal}
            </span>
          </button>
        </div>

        {activeTab === 'scheduled' ? (
          <EmailTable
            type="scheduled"
            emails={scheduled}
            isLoading={scheduledLoading}
            total={scheduledTotal}
            page={scheduledPage}
            pageSize={15}
            onPageChange={(page) => fetchScheduled(page, true)}
            onComposeClick={() => setComposeOpen(true)}
          />
        ) : (
          <EmailTable
            type="sent"
            emails={sent}
            isLoading={sentLoading}
            total={sentTotal}
            page={sentPage}
            pageSize={15}
            onPageChange={(page) => fetchSent(page, true)}
          />
        )}
      </main>

      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSchedule={handleScheduleBatch}
        defaultSender={user.email}
      />
    </div>
  );
};

export default App;
