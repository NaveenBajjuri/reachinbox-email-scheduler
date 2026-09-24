import React from 'react';
import type { Email, EmailStatus } from '../types/email';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Mail,
  ChevronLeft,
  ChevronRight,
  Send,
} from 'lucide-react';

interface EmailTableProps {
  type: 'scheduled' | 'sent';
  emails: Email[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  onComposeClick?: () => void;
}

const statusBadges: Record<
  EmailStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  SCHEDULED: {
    label: 'Scheduled',
    icon: <Clock className="w-3.5 h-3.5 mr-1" />,
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  PROCESSING: {
    label: 'Processing',
    icon: <RotateCw className="w-3.5 h-3.5 mr-1 animate-spin" />,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  SENT: {
    label: 'Sent',
    icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1" />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  FAILED: {
    label: 'Failed',
    icon: <AlertTriangle className="w-3.5 h-3.5 mr-1" />,
    className: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export const EmailTable: React.FC<EmailTableProps> = ({
  type,
  emails,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onComposeClick,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Table container */}
      <div className="overflow-x-auto min-h-[360px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3.5 px-6">Recipient</th>
              <th className="py-3.5 px-6">Subject</th>
              <th className="py-3.5 px-6">
                {type === 'scheduled' ? 'Scheduled For' : 'Sent Time'}
              </th>
              <th className="py-3.5 px-6">Sender</th>
              <th className="py-3.5 px-6">Status</th>
              {type === 'sent' && <th className="py-3.5 px-6">Attempts</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {isLoading ? (
              // Loading Skeleton
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-4 px-6">
                    <div className="h-4 bg-slate-200 rounded w-44"></div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-4 bg-slate-200 rounded w-60"></div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-4 bg-slate-200 rounded w-32"></div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-4 bg-slate-200 rounded w-36"></div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="h-6 bg-slate-200 rounded-full w-24"></div>
                  </td>
                  {type === 'sent' && (
                    <td className="py-4 px-6">
                      <div className="h-4 bg-slate-200 rounded w-8"></div>
                    </td>
                  )}
                </tr>
              ))
            ) : emails.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={type === 'sent' ? 6 : 5}
                  className="py-16 text-center text-slate-500"
                >
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-3">
                      {type === 'scheduled' ? (
                        <Clock className="w-7 h-7" />
                      ) : (
                        <Send className="w-7 h-7" />
                      )}
                    </div>
                    <h4 className="text-base font-semibold text-slate-800">
                      {type === 'scheduled'
                        ? 'No scheduled emails in queue'
                        : 'No sent emails yet'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 mb-4 text-center">
                      {type === 'scheduled'
                        ? 'Ready to reach out? Compose and schedule a new batch with custom delays and rate limits.'
                        : 'Emails delivered via BullMQ worker and Ethereal SMTP will appear here.'}
                    </p>
                    {type === 'scheduled' && onComposeClick && (
                      <button
                        onClick={onComposeClick}
                        className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        <span>Compose Batch</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              emails.map((email) => {
                const badge = statusBadges[email.status] || statusBadges.SCHEDULED;
                return (
                  <tr
                    key={email.id}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="py-3.5 px-6 font-medium text-slate-900">
                      {email.recipient}
                    </td>
                    <td className="py-3.5 px-6 text-slate-700 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 whitespace-nowrap">
                      {type === 'scheduled'
                        ? formatDate(email.scheduledAt)
                        : formatDate(email.sentAt || email.updatedAt)}
                    </td>
                    <td className="py-3.5 px-6 text-slate-500 text-xs">
                      {email.sender}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}
                      >
                        {badge.icon}
                        {badge.label}
                      </span>
                      {email.errorMessage && (
                        <div
                          className="text-[11px] text-rose-600 mt-1 max-w-xs truncate"
                          title={email.errorMessage}
                        >
                          {email.errorMessage}
                        </div>
                      )}
                    </td>
                    {type === 'sent' && (
                      <td className="py-3.5 px-6 text-slate-500 text-xs">
                        {email.attempts}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Showing <span className="font-semibold">{emails.length}</span> of{' '}
          <span className="font-semibold">{total}</span> total
        </span>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-slate-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
