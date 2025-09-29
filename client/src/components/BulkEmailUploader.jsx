import { useMemo, useRef, useState } from 'react';
import { apiFetch } from '../api/client.js';

const DEFAULT_SUBJECT_TEMPLATE = 'Your Ticket for {{event}}';
const DEFAULT_BODY_TEMPLATE = `<!doctype html>
<p>Hi {{name}},</p>
<p>We're excited to see you at <strong>{{event}}</strong>.</p>
<ul>
  <li><strong>Seat:</strong> {{seat}}</li>
  <li><strong>Ticket Code:</strong> {{ticket_code}}</li>
  <li><strong>Starts:</strong> {{event_starts}}</li>
</ul>
<p>Show this QR code at the entrance:</p>
<p><img src="cid:{{qr_cid}}" alt="Ticket QR" style="max-width:260px" /></p>
<p>If you have any questions, reply to this email.</p>`;

function BulkEmailUploader({ eventId, onQueued }) {
  const fileInputRef = useRef(null);
  const [manualEntries, setManualEntries] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [subjectTemplate, setSubjectTemplate] = useState(DEFAULT_SUBJECT_TEMPLATE);
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_BODY_TEMPLATE);
  const manualRecipients = useMemo(() => parseLines(manualEntries), [manualEntries]);

  const handleSubmit = async (evt) => {
    evt.preventDefault();
    const csvFile = fileInputRef.current?.files?.[0];

    const recipients = [];

    if (csvFile) {
      const text = await csvFile.text();
      const parsed = parseLines(text);
      recipients.push(...parsed);
    }

    recipients.push(...manualRecipients);

    if (recipients.length === 0) {
      alert('Add recipients using the CSV upload or the manual list.');
      return;
    }

    setIsUploading(true);
    try {
      const data = await apiFetch('/api/admin/emails/bulk', {
        method: 'POST',
        body: {
          event_id: eventId,
          list: recipients,
          subject: subjectTemplate,
          bodyTemplate,
        }
      });

      setLastReport({ type: 'queue', queued: data.queued, at: new Date(), details: data.details || [] });
      onQueued?.(data.queued);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      setManualEntries('');
      alert(`Queued ${data.queued} emails.`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to queue emails');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendNow = async () => {
    setIsSending(true);
    try {
      const result = await apiFetch('/api/admin/emails/send-now', {
        method: 'POST',
        body: { limit: 200 },
      });
      setLastReport({ type: 'send', result, at: new Date() });
      alert(`Sent ${result.sent} emails, ${result.failed} failed (pending batch size ${result.pending}).`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to send queued emails');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">Bulk Email Queue</h3>
      <p className="mt-2 text-sm text-slate-500">
  Upload a CSV or enter recipients manually. Seats are automatically assigned in order starting from Row A / Seat 1. Names are optional.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">CSV upload</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="manual-list">
            Manual entries
          </label>
          <textarea
            id="manual-list"
            rows="4"
            value={manualEntries}
            onChange={(e) => setManualEntries(e.target.value)}
            placeholder={['user@example.com', 'another@example.com'].join('\n')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <p className="text-xs text-slate-500">
            Separate recipients by new lines. Provide an email per line; names are optional.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="subject-template">
            Email subject template
          </label>
          <input
            id="subject-template"
            type="text"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <p className="text-xs text-slate-500">
            Use placeholders like <code>{'{{event}}'}</code>, <code>{'{{seat}}'}</code>, <code>{'{{ticket_code}}'}</code>.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="body-template">
            Email body template (HTML allowed)
          </label>
          <textarea
            id="body-template"
            rows="8"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 font-mono text-xs"
          />
          <div className="text-xs text-slate-500 space-y-1">
            <p>
              Available placeholders: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{event}}'}</code>, <code>{'{{seat}}'}</code>, <code>{'{{ticket_code}}'}</code>, <code>{'{{qr_cid}}'}</code>, <code>{'{{qr_data_url}}'}</code>, <code>{'{{event_starts}}'}</code>.
            </p>
            <p>
              For the inline QR image, use <code>{'<img src="cid:{{qr_cid}}" alt="QR code" />'}</code>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Manual recipients: {manualRecipients.length}</span>
          <span>{fileInputRef.current?.files?.length ? 'CSV attached' : 'No CSV file'}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            disabled={isUploading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
          >
            {isUploading ? 'Queueing…' : 'Queue Emails'}
          </button>
          <button
            type="button"
            onClick={handleSendNow}
            disabled={isSending}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-60"
          >
            {isSending ? 'Sending…' : 'Send queued now'}
          </button>
        </div>
      </form>

      {lastReport && (
        <div className="mt-4 space-y-2 text-xs text-slate-500">
          {lastReport.type === 'queue' && (
            <>
              <p>
                Last queued {lastReport.queued} recipient{lastReport.queued === 1 ? '' : 's'} at{' '}
                {lastReport.at.toLocaleTimeString()}.
              </p>
              {lastReport.details?.length ? (
                <ul className="max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2 font-mono text-[11px]">
                  {lastReport.details.map((item) => (
                    <li key={`${item.email}-${item.ticketCode}`}>
                      {item.email} → {item.seat} ({item.ticketCode})
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}

          {lastReport.type === 'send' && lastReport.result && (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
              <p>
                Last send run at {lastReport.at.toLocaleTimeString()}:
              </p>
              <ul className="ml-4 list-disc">
                <li>Sent: {lastReport.result.sent}</li>
                <li>Failed: {lastReport.result.failed}</li>
                <li>Processed from queue: {lastReport.result.pending}</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function parseLines(source) {
  if (!source) return [];
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const recipients = [];
  for (const line of lines) {
  const [emailRaw, nameRaw = '', ticketRaw = ''] = line.split(',');
    const email = emailRaw?.trim();
    if (!email) continue;
    recipients.push({
      email,
      name: nameRaw.trim(),
      ticketData: ticketRaw.trim(),
    });
  }
  return recipients;
}

export default BulkEmailUploader;
