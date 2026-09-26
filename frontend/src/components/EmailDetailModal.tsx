import React from 'react';
import { ArrowLeft, Star, Trash2, Archive, ExternalLink } from 'lucide-react';
import type { Email } from '../types/email';

interface EmailDetailModalProps {
  email: Email | null;
  onClose: () => void;
}

export const EmailDetailModal: React.FC<EmailDetailModalProps> = ({ email, onClose }) => {
  if (!email) return null;

  const senderInitial = (email.sender || 'S').charAt(0).toUpperCase();
  const dateFormatted = new Date(email.sentAt || email.scheduledAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-y-auto">
      {/* Top Header Bar matching Figma media_1790422690293.png */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div className="flex items-center space-x-3 overflow-hidden">
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-slate-900 truncate">
            {email.subject}
          </h2>
        </div>

        <div className="flex items-center space-x-3 text-slate-400">
          <button className="p-1.5 hover:text-amber-500 hover:bg-slate-100 rounded-lg transition-colors">
            <Star className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
            <Archive className="w-4 h-4" />
          </button>
          <button className="p-1.5 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Email Body Canvas */}
      <div className="max-w-4xl mx-auto w-full px-6 py-8 flex-1">
        {/* Sender details row */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-[#00A854] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
              {senderInitial}
            </div>
            <div>
              <div className="flex items-baseline space-x-2">
                <span className="font-semibold text-sm text-slate-900">
                  {email.sender.split('@')[0]}
                </span>
                <span className="text-xs text-slate-400">&lt;{email.sender}&gt;</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                to {email.recipient}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 font-medium">{dateFormatted}</span>
            {email.previewUrl && (
              <div className="mt-1">
                <a
                  href={email.previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-1 text-xs text-[#00A854] hover:underline font-semibold"
                >
                  <span>View on Ethereal</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Status Alert if failed or processing */}
        {email.status === 'FAILED' && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <p className="font-semibold">Delivery note:</p>
            <p className="mt-0.5">{email.errorMessage || 'Failed to send'}</p>
          </div>
        )}

        {/* Email HTML / Text Body */}
        <div
          className="prose prose-sm max-w-none text-slate-800 leading-relaxed font-sans"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />
      </div>
    </div>
  );
};
