import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Email, ScheduleEmailPayload } from './types/email';
import { api } from './lib/api';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { EmailListView } from './components/EmailListView';
import { EmailDetailModal } from './components/EmailDetailModal';
import { ComposeModal } from './components/ComposeModal';
import { LoginView } from './components/LoginView';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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
        const res = await api.emails.getScheduled(page, 20);
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
        const res = await api.emails.getSent(page, 20);
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

  // Periodic polling for worker state updates
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

  // Filter emails based on search query
  const displayedEmails = useMemo(() => {
    const list = activeTab === 'scheduled' ? scheduled : sent;
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (e) =>
        e.recipient.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q)
    );
  }, [activeTab, scheduled, sent, searchQuery]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00A854] border-t-transparent rounded-full animate-spin"></div>
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
    <div className="flex h-screen bg-white overflow-hidden text-slate-900 font-sans">
      {/* Left Sidebar matching Figma */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSearchQuery('');
        }}
        onComposeClick={() => setComposeOpen(true)}
        scheduledCount={scheduledTotal}
        sentCount={sentTotal}
        onLogout={handleLogout}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white">
        {/* Top bar with Search, Filter & Refresh matching Figma */}
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          isLoading={scheduledLoading || sentLoading}
        />

        {/* Floating Toast Notification */}
        {toast && (
          <div className="px-6 pt-3">
            <div
              className={`p-3 rounded-xl flex items-center space-x-2.5 text-xs border shadow-xs animate-in slide-in-from-top-2 duration-150 ${
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
              <span className="font-medium">{toast.message}</span>
            </div>
          </div>
        )}

        {/* Email Rows List View matching Figma */}
        <div className="flex-1 overflow-hidden">
          <EmailListView
            type={activeTab}
            emails={displayedEmails}
            isLoading={activeTab === 'scheduled' ? scheduledLoading : sentLoading}
            total={activeTab === 'scheduled' ? scheduledTotal : sentTotal}
            page={activeTab === 'scheduled' ? scheduledPage : sentPage}
            pageSize={20}
            onPageChange={(page) =>
              activeTab === 'scheduled' ? fetchScheduled(page, true) : fetchSent(page, true)
            }
            onSelectEmail={(email) => setSelectedEmail(email)}
            onComposeClick={() => setComposeOpen(true)}
          />
        </div>
      </main>

      {/* Email Detailed Reader Drawer/Modal matching Figma */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      )}

      {/* Compose Email Modal matching Figma */}
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
