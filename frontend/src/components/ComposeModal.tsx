import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Calendar, Clock, Gauge, Loader2 } from 'lucide-react';
import type { ScheduleEmailPayload, LeadParseResult } from '../types/email';
import { parseLeads } from '../lib/csvParser';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (payload: ScheduleEmailPayload) => Promise<void>;
  defaultSender: string;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSchedule,
  defaultSender,
}) => {
  if (!isOpen) return null;

  // Form states
  const [sender, setSender] = useState(defaultSender || 'scheduler@reachinbox.ai');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rawLeadText, setRawLeadText] = useState('');
  const [parseResult, setParseResult] = useState<LeadParseResult>({
    validEmails: [],
    invalidCount: 0,
    totalParsed: 0,
  });

  // Scheduling timing states
  // Default to 1 minute in the future
  const defaultStartTime = new Date(Date.now() + 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLeadTextChange = (text: string) => {
    setRawLeadText(text);
    const parsed = parseLeads(text);
    setParseResult(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleLeadTextChange(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!subject.trim()) {
      setErrorMessage('Subject cannot be empty');
      return;
    }

    if (!body.trim()) {
      setErrorMessage('Email body cannot be empty');
      return;
    }

    if (parseResult.validEmails.length === 0) {
      setErrorMessage('Please upload or enter at least one valid recipient email address');
      return;
    }

    const startDateTime = new Date(startTime);
    if (isNaN(startDateTime.getTime())) {
      setErrorMessage('Please provide a valid start time');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSchedule({
        sender: sender.trim(),
        subject: subject.trim(),
        body: body.trim(),
        recipients: parseResult.validEmails,
        startTime: startDateTime.toISOString(),
        delayBetweenEmails: Math.max(0, delaySeconds * 1000),
        hourlyLimit: Math.max(1, hourlyLimit),
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || err.message || 'Failed to schedule emails'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Compose & Schedule Campaign</h3>
            <p className="text-xs text-slate-500">Configure batch parameters, delays, and lead list</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sender */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sender Email
            </label>
            <input
              type="email"
              required
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              placeholder="sender@domain.com"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
              placeholder="Exciting update for your team"
            />
          </div>

          {/* CSV / Lead Upload & Paste */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Recipients (CSV Upload or Paste)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV / TXT</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <textarea
              rows={4}
              value={rawLeadText}
              onChange={(e) => handleLeadTextChange(e.target.value)}
              placeholder="Paste leads line-by-line or comma-separated:&#10;alice@company.com&#10;bob@startup.io"
              className="w-full px-3.5 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all"
            />

            {/* Parsing Stats Badge */}
            {rawLeadText && (
              <div className="mt-1.5 flex items-center space-x-2 text-xs">
                {parseResult.validEmails.length > 0 ? (
                  <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{parseResult.validEmails.length} valid addresses detected</span>
                  </span>
                ) : (
                  <span className="text-amber-600 text-xs">No valid email addresses found yet.</span>
                )}

                {parseResult.invalidCount > 0 && (
                  <span className="inline-flex items-center space-x-1 text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-medium">
                    <span>{parseResult.invalidCount} invalid rows ignored</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email Content (HTML / Text)
            </label>
            <textarea
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="<p>Hi there,</p><p>We wanted to share...</p>"
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-sans"
            />
          </div>

          {/* Scheduling Configuration Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {/* Start Time */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Start Time</span>
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            {/* Delay Between Sends */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Delay (seconds)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                placeholder="2"
              />
              <span className="text-[10px] text-slate-400">Gap between jobs</span>
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Gauge className="w-3.5 h-3.5 text-indigo-600" />
                <span>Hourly Limit</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
                placeholder="100"
              />
              <span className="text-[10px] text-slate-400">Max sends / hour</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || parseResult.validEmails.length === 0}
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Scheduling Batch...</span>
                </>
              ) : (
                <span>Schedule {parseResult.validEmails.length > 0 ? `(${parseResult.validEmails.length})` : ''} Emails</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
