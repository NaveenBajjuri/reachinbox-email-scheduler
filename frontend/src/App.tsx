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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtering & Sorting State
  const [filterOption, setFilterOption] = useState<'all' | 'starred' | 'sent' | 'failed'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // Starred IDs persisted across sessions
  const [starredIds, setStarredIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('starred_email_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

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

  const handleToggleStar = (id: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      const isStarred = next.has(id);
      if (isStarred) {
        next.delete(id);
        notify('Removed from Starred');
      } else {
        next.add(id);
        notify('Added to Starred', 'success');
      }
      try {
        localStorage.setItem('starred_email_ids', JSON.stringify([...next]));
      } catch {
        // ignore storage errors
      }
      return next;
    });
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
        fetchSent(sentPage, false);
      } else {
        fetchSent(sentPage, true);
        fetchScheduled(scheduledPage, false);
      }
    }
  }, [user, activeTab, scheduledPage, sentPage, fetchScheduled, fetchSent]);

  // Periodic polling for worker state updates across both scheduled and sent
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchScheduled(scheduledPage, false);
      fetchSent(sentPage, false);
    }, 4000);

    return () => clearInterval(interval);
  }, [user, scheduledPage, sentPage, fetchScheduled, fetchSent]);

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
    fetchSent(1, false);
  };

  const handleRefresh = () => {
    fetchScheduled(scheduledPage, activeTab === 'scheduled');
    fetchSent(sentPage, activeTab === 'sent');
    notify('Refreshed email list', 'success');
  };

  const handleDeleteEmail = async (id: string) => {
    await api.emails.delete(id);
    setScheduled((prev) => prev.filter((e) => e.id !== id));
    setSent((prev) => prev.filter((e) => e.id !== id));
    if (activeTab === 'scheduled') {
      setScheduledTotal((t) => Math.max(0, t - 1));
    } else {
      setSentTotal((t) => Math.max(0, t - 1));
    }
    setSelectedEmail(null);
  };

  const handleArchiveEmail = (email: Email) => {
    setScheduled((prev) => prev.filter((e) => e.id !== email.id));
    setSent((prev) => prev.filter((e) => e.id !== email.id));
    if (activeTab === 'scheduled') {
      setScheduledTotal((t) => Math.max(0, t - 1));
    } else {
      setSentTotal((t) => Math.max(0, t - 1));
    }
    setSelectedEmail(null);
  };

  const handleTabChange = (tab: 'scheduled' | 'sent') => {
    setActiveTab(tab);
    setSearchQuery('');
    if (tab === 'scheduled' && (filterOption === 'sent' || filterOption === 'failed')) {
      setFilterOption('all');
    }
  };

  // Filter & sort emails
  const displayedEmails = useMemo(() => {
    let list = activeTab === 'scheduled' ? [...scheduled] : [...sent];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.recipient.toLowerCase().includes(q) ||
          e.subject.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q)
      );
    }

    if (filterOption === 'starred') {
      list = list.filter((e) => starredIds.has(e.id));
    } else if (filterOption === 'sent') {
      list = list.filter((e) => e.status === 'SENT');
    } else if (filterOption === 'failed') {
      list = list.filter((e) => e.status === 'FAILED');
    }

    list.sort((a, b) => {
      const timeA = new Date(a.scheduledAt || a.createdAt).getTime();
      const timeB = new Date(b.scheduledAt || b.createdAt).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [activeTab, scheduled, sent, searchQuery, filterOption, starredIds, sortOrder]);

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
        onTabChange={handleTabChange}
        onComposeClick={() => setComposeOpen(true)}
        scheduledCount={scheduledTotal}
        sentCount={sentTotal}
        onLogout={handleLogout}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-white w-full min-w-0">
        {/* Top bar with Search, Filter & Refresh matching Figma */}
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          isLoading={scheduledLoading || sentLoading}
          activeTab={activeTab}
          filterOption={filterOption}
          onFilterChange={setFilterOption}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
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
            starredIds={starredIds}
            onToggleStar={handleToggleStar}
          />
        </div>
      </main>

      {/* Email Detailed Reader Drawer/Modal matching Figma */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          user={user}
          isStarred={starredIds.has(selectedEmail.id)}
          onToggleStar={handleToggleStar}
          onClose={() => setSelectedEmail(null)}
          onDelete={handleDeleteEmail}
          onArchive={handleArchiveEmail}
          onNotify={notify}
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
