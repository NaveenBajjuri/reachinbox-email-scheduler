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
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] text-[#00A854] flex items-center justify-center mb-3">
          <Inbox className="w-6 h-6" />
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
            type="button"
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
      {/* Email rows with responsive mobile cards and desktop table rows */}
      <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
        {emails.map((email) => {
          const isStarred = starredIds.has(email.id);
          const rawSnippet = email.body.replace(/<[^>]*>?/gm, '').trim();
          const recipientName = email.recipient.split('@')[0];

          return (
            <div
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className="px-4 sm:px-6 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group select-none text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4"
            >
              {/* Row 1 on mobile: To & Badges & Star | Left col on desktop: To */}
              <div className="flex items-center justify-between sm:justify-start gap-2 sm:w-36 shrink-0">
                <span className="font-bold text-slate-900 truncate">
                  To: {recipientName}
                </span>

                {/* Mobile Right Icons (Badge + Star) */}
                <div className="flex sm:hidden items-center space-x-2 shrink-0">
                  {type === 'scheduled' ? (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                      <Clock className="w-2.5 h-2.5" />
                      <span>{formatScheduleBadge(email.scheduledAt)}</span>
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        email.status === 'SENT'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {email.status === 'SENT' ? 'Sent' : 'Failed'}
                    </span>
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
                    <Star className={`w-3.5 h-3.5 ${isStarred ? 'fill-amber-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Row 2 on mobile: Subject & Snippet | Middle col on desktop: Badge + Subject + Snippet */}
              <div className="flex-1 flex items-center space-x-3 overflow-hidden pr-2">
                {/* Desktop Badge */}
                <div className="hidden sm:inline-flex shrink-0">
                  {type === 'scheduled' ? (
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2]">
                      <Clock className="w-3 h-3" />
                      <span>{formatScheduleBadge(email.scheduledAt)}</span>
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        email.status === 'SENT'
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {email.status === 'SENT' ? 'Sent' : 'Failed'}
                    </span>
                  )}
                </div>

                {/* Subject & Preview Snippet */}
                <div className="truncate text-slate-600 text-xs">
                  <span className="font-semibold text-slate-900">
                    {email.subject || '(No Subject)'}
                  </span>
                  <span className="text-slate-400 mx-1.5">—</span>
                  <span className="text-slate-400 truncate">{rawSnippet}</span>
                </div>
              </div>

              {/* Desktop Right Column: Ethereal Link & Star matching Figma */}
              <div className="hidden sm:flex items-center space-x-2 shrink-0">
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
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </span>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-slate-700 font-medium px-1">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
