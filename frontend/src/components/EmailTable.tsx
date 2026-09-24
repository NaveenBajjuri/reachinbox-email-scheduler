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
  ExternalLink,
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
    icon: <Clock className="w-3 h-3 mr-1" />,
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  PROCESSING: {
    label: 'Processing',
    icon: <RotateCw className="w-3 h-3 mr-1 animate-spin" />,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  SENT: {
    label: 'Sent',
    icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  FAILED: {
    label: 'Failed',
    icon: <AlertTriangle className="w-3 h-3 mr-1" />,
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
    <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto min-h-[340px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-5">Recipient</th>
              <th className="py-3 px-5">Subject</th>
              <th className="py-3 px-5">
                {type === 'scheduled' ? 'Scheduled For' : 'Sent Time'}
              </th>
              <th className="py-3 px-5">Sender</th>
              <th className="py-3 px-5">Status</th>
              {type === 'sent' && <th className="py-3 px-5">Attempts</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-3.5 px-5">
                    <div className="h-3.5 bg-slate-200 rounded w-40"></div>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="h-3.5 bg-slate-200 rounded w-52"></div>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="h-3.5 bg-slate-200 rounded w-28"></div>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="h-3.5 bg-slate-200 rounded w-32"></div>
                  </td>
                  <td className="py-3.5 px-5">
                    <div className="h-5 bg-slate-200 rounded-full w-20"></div>
                  </td>
                  {type === 'sent' && (
                    <td className="py-3.5 px-5">
                      <div className="h-3.5 bg-slate-200 rounded w-6"></div>
                    </td>
                  )}
                </tr>
              ))
            ) : emails.length === 0 ? (
              <tr>
                <td
                  colSpan={type === 'sent' ? 6 : 5}
                  className="py-16 text-center text-slate-500"
                >
                  <div className="max-w-xs mx-auto flex flex-col items-center">
                    <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mb-2.5">
                      {type === 'scheduled' ? (
                        <Clock className="w-5 h-5" />
                      ) : (
                        <Send className="w-5 h-5" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      {type === 'scheduled'
                        ? 'No scheduled emails'
                        : 'No sent emails'}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 mb-3 text-center">
                      {type === 'scheduled'
                        ? 'Schedule your first batch to see it queued here.'
                        : 'Delivered messages will be logged here.'}
                    </p>
                    {type === 'scheduled' && onComposeClick && (
                      <button
                        onClick={onComposeClick}
                        className="inline-flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Compose</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              emails.map((email) => {
                const badge = statusBadges[email.status] || statusBadges.SCHEDULED;
                return (
                  <tr key={email.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-5 font-medium text-slate-800">
                      {email.recipient}
                    </td>
                    <td className="py-3 px-5 text-slate-600 max-w-xs truncate">
                      {email.subject}
                    </td>
                    <td className="py-3 px-5 text-slate-500 whitespace-nowrap">
                      {type === 'scheduled'
                        ? formatDate(email.scheduledAt)
                        : formatDate(email.sentAt || email.updatedAt)}
                    </td>
                    <td className="py-3 px-5 text-slate-500">
                      {email.sender}
                    </td>
                    <td className="py-3 px-5">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.className}`}
                        >
                          {badge.icon}
                          {badge.label}
                        </span>
                        {type === 'sent' && email.status === 'SENT' && (
                          <a
                            href={email.previewUrl || 'https://ethereal.email/messages'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 border border-indigo-200 transition-colors"
                            title={email.previewUrl ? 'Open rendered email in Ethereal' : 'Inspect in Ethereal mailbox'}
                          >
                            <span>View on Ethereal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {email.errorMessage && (
                        <div
                          className="text-[10px] text-rose-600 mt-0.5 max-w-xs truncate"
                          title={email.errorMessage}
                        >
                          {email.errorMessage}
                        </div>
                      )}
                    </td>
                    {type === 'sent' && (
                      <td className="py-3 px-5 text-slate-500 text-xs">
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

      <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Total: <span className="font-semibold text-slate-700">{total}</span>
        </span>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-slate-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
