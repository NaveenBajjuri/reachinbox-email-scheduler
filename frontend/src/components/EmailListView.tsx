import React from 'react';
import { Clock, Star, ExternalLink, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import type { Email } from '../types/email';

interface EmailListViewProps {
  type: 'scheduled' | 'sent';
  emails: Email[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onSelectEmail: (email: Email) => void;
  onComposeClick?: () => void;
  starredIds: Set<string>;
  onToggleStar: (id: string) => void;
}

export const EmailListView: React.FC<EmailListViewProps> = ({
  type,
  emails,
  isLoading,
  total,
  page,
  pageSize,
  onPageChange,
  onSelectEmail,
  onComposeClick,
  starredIds,
  onToggleStar,
}) => {
  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onToggleStar(id);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const formatScheduleBadge = (dateString: string) => {
    const d = new Date(dateString);
    const day = d.toLocaleDateString('en-US', { weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${day} ${time}`;
  };

  if (isLoading && emails.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <div className="w-7 h-7 border-2 border-[#00A854] border-t-transparent rounded-full animate-spin mb-3"></div>
        <span className="text-xs font-medium">Loading emails...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-center px-4">
        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mb-3">
          <Inbox className="w-7 h-7" />
        </div>
        <p className="text-sm font-semibold text-slate-800">
          No {type === 'scheduled' ? 'scheduled' : 'sent'} emails yet
        </p>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-5">
          {type === 'scheduled'
            ? 'Schedule your first delayed email or lead campaign using BullMQ.'
            : 'Delivered emails will appear here with delivery timestamps and Ethereal links.'}
        </p>
        {type === 'scheduled' && onComposeClick && (
          <button
            onClick={onComposeClick}
            className="px-4 py-2 border border-[#00A854] text-[#00A854] hover:bg-[#E8F5E9]/60 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            Compose Email
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Email rows matching Figma */}
      <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
        {emails.map((email) => {
          const isStarred = starredIds.has(email.id);
          const rawSnippet = email.body.replace(/<[^>]*>?/gm, '').trim();
          const recipientName = email.recipient.split('@')[0];

          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer group select-none text-xs"
            >
              {/* Left: Recipient Name */}
              <div className="w-36 shrink-0 font-bold text-slate-900 truncate pr-2">
                To: {recipientName}
              </div>

              {/* Middle: Badge + Subject + Snippet */}
              <div className="flex-1 flex items-center space-x-3 overflow-hidden pr-4">
                {type === 'scheduled' ? (
                  /* Orange Badge for Scheduled Emails matching Figma */
                  <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2] shrink-0">
                    <Clock className="w-3 h-3" />
                    <span>{formatScheduleBadge(email.scheduledAt)}</span>
                  </span>
                ) : (
                  /* Status Badge for Sent Emails matching Figma */
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${
                      email.status === 'SENT'
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {email.status === 'SENT' ? 'Sent' : 'Failed'}
                  </span>
                )}

                {/* Subject & Preview Snippet */}
                <div className="truncate text-slate-600 text-xs">
                  <span className="font-semibold text-slate-900">
                    {email.subject || '(No Subject)'}
                  </span>
                  <span className="text-slate-400 mx-1.5">—</span>
                  <span className="text-slate-400 truncate">{rawSnippet}</span>
                </div>
              </div>

              {/* Right: Ethereal Link & Star matching Figma */}
              <div className="flex items-center space-x-2 shrink-0">
                {email.previewUrl && (
                  <a
                    href={email.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 text-[11px] font-semibold text-[#00A854] hover:underline flex items-center space-x-1 px-2 py-0.5 rounded-md hover:bg-emerald-50 transition-all"
                  >
                    <span>Ethereal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={(e) => toggleStar(e, email.id)}
                  className={`p-1 rounded-md transition-colors ${
                    isStarred
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-slate-300 hover:text-slate-500'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isStarred ? 'fill-amber-400' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-medium text-slate-700">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded-md border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
