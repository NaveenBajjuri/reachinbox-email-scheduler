import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle2, AlertCircle, Calendar, Clock, Gauge, Loader2 } from 'lucide-react';
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
  const [sender, setSender] = useState(defaultSender || 'scheduler@reachinbox.ai');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [rawLeadText, setRawLeadText] = useState('');
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

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleLeadTextChange = (text: string) => {
    setRawLeadText(text);
    const parsed = parseLeads(text);
    setParseResult(parsed);
  };

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
        setRawLeadText(parsed.validEmails.join('\n'));
      } catch (err: any) {
        setErrorMessage(
          'Failed to read Excel file. Please ensure it is a valid .xlsx or .csv spreadsheet.'
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleLeadTextChange(content);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      setErrorMessage('Failed to read uploaded file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!subject.trim()) {
      setErrorMessage('Subject is required');
      return;
    }

    if (!body.trim()) {
      setErrorMessage('Body is required');
      return;
    }

    if (parseResult.validEmails.length === 0) {
      setErrorMessage('Provide at least one valid recipient');
      return;
    }

    const startDateTime = new Date(startTime);
    if (isNaN(startDateTime.getTime())) {
      setErrorMessage('Invalid start time');
      return;
    }

    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Compose Campaign</h3>
            <p className="text-xs text-slate-500">Configure parameters and target recipients</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center space-x-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Sender
            </label>
            <input
              type="email"
              required
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              placeholder="sender@domain.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              placeholder="Campaign Subject"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Recipients (CSV, Excel, or manual)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV / Excel</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <textarea
              rows={4}
              value={rawLeadText}
              onChange={(e) => handleLeadTextChange(e.target.value)}
              placeholder="paste emails line-by-line, comma-separated, or upload CSV / Excel file"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
            />

            {rawLeadText && (
              <div className="mt-1.5 flex items-center space-x-2 text-xs">
                {parseResult.validEmails.length > 0 ? (
                  <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-medium text-[11px]">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{parseResult.validEmails.length} valid addresses detected</span>
                  </span>
                ) : (
                  <span className="text-amber-600 text-[11px]">No valid addresses detected</span>
                )}

                {parseResult.invalidCount > 0 && (
                  <span className="inline-flex items-center space-x-1 text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-medium text-[11px]">
                    <span>{parseResult.invalidCount} invalid rows ignored</span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Body
            </label>
            <textarea
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-slate-500" />
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Delay (sec)</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center space-x-1">
                <Gauge className="w-3 h-3 text-slate-500" />
                <span>Hourly Limit</span>
              </label>
              <input
                type="number"
                min="1"
                required
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || parseResult.validEmails.length === 0}
              className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scheduling...</span>
                </>
              ) : (
                <span>Schedule Batch ({parseResult.validEmails.length})</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
