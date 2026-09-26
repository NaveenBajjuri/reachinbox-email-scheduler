import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Paperclip,
  Clock,
  Calendar,
  Upload,
  AlertCircle,
  Loader2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  List,
  Quote,
  Code,
  Strikethrough,
  Undo2,
  Redo2,
  Type,
  X,
} from 'lucide-react';
import readXlsxFile from 'read-excel-file/browser';
import type { ScheduleEmailPayload, LeadParseResult } from '../types/email';
import { parseLeads, parseRows } from '../lib/csvParser';

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
  const [sender] = useState(defaultSender || 'oliver.brown@domain.io');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [recipientsList, setRecipientsList] = useState<string[]>([]);
  const [parseResult, setParseResult] = useState<LeadParseResult>({
    validEmails: [],
    invalidCount: 0,
    totalParsed: 0,
  });

  const [startTime, setStartTime] = useState(() =>
    new Date(Date.now() + 60 * 1000).toISOString().slice(0, 16)
  );
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);

  const [sendLaterOpen, setSendLaterOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'xlsx' || extension === 'xls') {
      try {
        const sheets = await readXlsxFile(file);
        const allRows = sheets.flatMap((s) => s.data);
        const parsed = parseRows(allRows);
        setParseResult(parsed);
        setRecipientsList(parsed.validEmails);
      } catch {
        setErrorMessage('Failed to read Excel file. Please ensure it is a valid spreadsheet.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    // CSV or Text file upload
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const parsed = parseLeads(content);
      setParseResult(parsed);
      setRecipientsList(parsed.validEmails);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read uploaded file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleManualAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = manualTo.trim().replace(/,/g, '');
      if (trimmed && trimmed.includes('@')) {
        if (!recipientsList.includes(trimmed)) {
          const next = [...recipientsList, trimmed];
          setRecipientsList(next);
          setParseResult({ validEmails: next, invalidCount: 0, totalParsed: next.length });
        }
        setManualTo('');
      }
    }
  };

  const removeRecipient = (indexToRemove: number) => {
    const next = recipientsList.filter((_, idx) => idx !== indexToRemove);
    setRecipientsList(next);
    setParseResult({ validEmails: next, invalidCount: 0, totalParsed: next.length });
  };

  // Helper for quick schedule presets
  const applyPreset = (hoursFromNow: number) => {
    const d = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    setStartTime(d.toISOString().slice(0, 16));
  };

  const handleSubmit = async () => {
    setErrorMessage(null);

    // If manual recipient is typed but not tagged yet
    let finalRecipients = [...recipientsList];
    if (manualTo.trim() && manualTo.includes('@')) {
      finalRecipients.push(manualTo.trim());
    }

    if (!subject.trim()) {
      setErrorMessage('Please enter a subject');
      return;
    }

    if (!body.trim()) {
      setErrorMessage('Please write email content');
      return;
    }

    if (finalRecipients.length === 0) {
      setErrorMessage('Please provide at least one recipient email address or upload a list');
      return;
    }

    const startDateTime = new Date(startTime);
    if (isNaN(startDateTime.getTime())) {
      setErrorMessage('Invalid scheduled start time');
      return;
    }

    setSubmitting(true);
    try {
      await onSchedule({
        sender: sender.trim(),
        subject: subject.trim(),
        body: body.trim(),
        recipients: finalRecipients,
        startTime: startDateTime.toISOString(),
        delayBetweenEmails: Math.max(0, delaySeconds * 1000),
        hourlyLimit: Math.max(1, hourlyLimit),
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.error || err.message || 'Failed to schedule campaign'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-y-auto animate-in fade-in duration-150">
      {/* Top Header Bar matching Figma media_1790422701412.png */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-semibold text-slate-900">
            Compose New Email
          </h2>
        </div>

        {/* Action icons & Send Later button on right */}
        <div className="flex items-center space-x-3 relative">
          <button
            type="button"
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center space-x-1"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
            <span className="text-[10px] text-slate-400">1</span>
          </button>

          <button
            type="button"
            onClick={() => setSendLaterOpen(!sendLaterOpen)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              sendLaterOpen
                ? 'bg-emerald-50 text-[#00A854]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
            title="Send Later options"
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Green outlined button matching Figma */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-1.5 border border-[#00A854] text-[#00A854] hover:bg-[#E8F5E9]/60 active:scale-95 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center space-x-1.5"
          >
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Scheduling...</span>
              </>
            ) : (
              <span>Send Later</span>
            )}
          </button>

          {/* Send Later Popover matching Figma media_1790422701412.png */}
          {sendLaterOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-5 z-50 animate-in zoom-in-95 duration-100">
              <h4 className="text-sm font-bold text-slate-900 mb-3">Send Later</h4>

              <div className="mb-4">
                <label className="block text-[11px] text-slate-400 mb-1 flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>Pick date &amp; time</span>
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-[#00A854]"
                />
              </div>

              {/* Quick Preset options */}
              <div className="space-y-1.5 mb-5 text-xs text-slate-600">
                <button
                  type="button"
                  onClick={() => applyPreset(12)}
                  className="w-full text-left py-1 px-2 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(18)}
                  className="w-full text-left py-1 px-2 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Tomorrow, 10:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(19)}
                  className="w-full text-left py-1 px-2 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Tomorrow, 11:00 AM
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(23)}
                  className="w-full text-left py-1 px-2 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  Tomorrow, 3:00 PM
                </button>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSendLaterOpen(false)}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setSendLaterOpen(false)}
                  className="px-4 py-1 border border-[#00A854] text-[#00A854] hover:bg-emerald-50 rounded-full text-xs font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Compose Canvas */}
      <div className="max-w-4xl mx-auto w-full px-6 py-6 flex-1 flex flex-col space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* From Row matching Figma */}
        <div className="flex items-center space-x-4 py-1 border-b border-slate-100 text-xs">
          <span className="w-16 text-slate-400 font-medium">From</span>
          <div className="px-2.5 py-1 bg-slate-100/70 rounded-md font-medium text-slate-700 flex items-center space-x-1">
            <span>{sender}</span>
            <span className="text-[10px] text-slate-400">⌄</span>
          </div>
        </div>

        {/* To Row with Green Tags & Upload List button matching Figma */}
        <div className="flex items-start space-x-4 py-2 border-b border-slate-100 text-xs">
          <span className="w-16 pt-1.5 text-slate-400 font-medium">To</span>
          <div className="flex-1 flex flex-wrap items-center gap-1.5">
            {/* Green pill tags matching media_1790422815150.png */}
            {recipientsList.slice(0, 3).map((email, idx) => (
              <span
                key={email}
                className="inline-flex items-center space-x-1 bg-[#E8F5E9] border border-[#C8E6C9] text-[#00A854] px-2.5 py-1 rounded-full text-xs font-medium"
              >
                <span>{email}</span>
                <button
                  type="button"
                  onClick={() => removeRecipient(idx)}
                  className="hover:text-emerald-900 cursor-pointer ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {recipientsList.length > 3 && (
              <span className="inline-flex items-center bg-[#E8F5E9] border border-[#C8E6C9] text-[#00A854] px-2.5 py-1 rounded-full text-xs font-bold">
                +{recipientsList.length - 3}
              </span>
            )}

            {parseResult.invalidCount > 0 && (
              <span className="text-[11px] text-slate-400 self-center">
                ({parseResult.invalidCount} invalid rows ignored)
              </span>
            )}

            <input
              type="email"
              value={manualTo}
              onChange={(e) => setManualTo(e.target.value)}
              onKeyDown={handleManualAdd}
              placeholder={recipientsList.length === 0 ? 'recipient@example.com' : 'Add another...'}
              className="flex-1 min-w-[180px] py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
          </div>

          {/* Upload List action on right matching Figma */}
          <div className="shrink-0 pl-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-[#00A854] hover:text-[#009249] cursor-pointer py-1 px-2 rounded-lg hover:bg-emerald-50 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload List</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Subject Row matching Figma */}
        <div className="flex items-center space-x-4 py-2 border-b border-slate-100 text-xs">
          <span className="w-16 text-slate-400 font-medium">Subject</span>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        {/* Inline Delay & Hourly Limit matching Figma media_1790422701412.png */}
        <div className="flex items-center space-x-8 py-2 border-b border-slate-100 text-xs text-slate-600">
          <div className="flex items-center space-x-3">
            <span className="text-slate-500 font-medium">Delay between 2 emails</span>
            <input
              type="number"
              min="0"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-mono focus:outline-none focus:border-[#00A854]"
            />
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-slate-500 font-medium">Hourly Limit</span>
            <input
              type="number"
              min="1"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-14 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs font-mono focus:outline-none focus:border-[#00A854]"
            />
          </div>
        </div>

        {/* Rich Text Editor Container matching Figma */}
        <div className="flex-1 flex flex-col bg-[#F9FAFB] rounded-2xl border border-slate-200/70 p-4 min-h-[300px]">
          {/* Formatting Toolbar */}
          <div className="flex items-center space-x-1 pb-3 mb-3 border-b border-slate-200/80 text-slate-400 text-xs overflow-x-auto">
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md flex items-center">
              <Type className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <Underline className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-slate-200 mx-1" />
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <List className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <Quote className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <Code className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1.5 hover:text-slate-700 hover:bg-slate-200/50 rounded-md">
              <Strikethrough className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Text Area */}
          <textarea
            required
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="flex-1 w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};
