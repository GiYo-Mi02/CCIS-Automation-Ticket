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
    <div className="glass-card flex h-full flex-col gap-6 p-6">
      <div className="space-y-2">
        <p className="glass-section-label">Bulk email queue</p>
        <h3 className="text-lg font-semibold text-white">Ticket delivery automation</h3>
        <p className="text-sm text-slate-200/80">
          Upload a CSV or paste recipients to queue personalized tickets. Seats are auto-assigned in order starting at Row A · Seat 1.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="input-label">CSV upload</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="block w-full text-sm text-slate-200 file:mr-4 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-sky-500 file:via-indigo-500 file:to-purple-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
        </div>

        <div className="space-y-2">
          <label className="input-label" htmlFor="manual-list">
            Manual entries
          </label>
          <textarea
            id="manual-list"
            rows="4"
            value={manualEntries}
            onChange={(e) => setManualEntries(e.target.value)}
            placeholder={['user@example.com', 'another@example.com'].join('\n')}
            className="input-field font-mono text-xs"
          />
          <p className="text-xs text-slate-300/80">
            Separate entries with new lines. Provide one email per line; names and notes are optional after a comma.
          </p>
        </div>

        <div className="space-y-2">
          <label className="input-label" htmlFor="subject-template">
            Email subject template
          </label>
          <input
            id="subject-template"
            type="text"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            className="input-field"
          />
          <p className="text-xs text-slate-300/80">
            Use tokens like <code>{'{{event}}'}</code>, <code>{'{{seat}}'}</code>, <code>{'{{ticket_code}}'}</code>.
          </p>
        </div>

        <div className="space-y-2">
          <label className="input-label" htmlFor="body-template">
            Email body template (HTML supported)
          </label>
          <textarea
            id="body-template"
            rows="8"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            className="input-field font-mono text-xs"
          />
          <div className="space-y-1 text-xs text-slate-300/80">
            <p>
              Available placeholders: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{event}}'}</code>, <code>{'{{seat}}'}</code>, <code>{'{{ticket_code}}'}</code>, <code>{'{{qr_cid}}'}</code>, <code>{'{{qr_data_url}}'}</code>, <code>{'{{event_starts}}'}</code>.
            </p>
            <p>
              To embed the QR inline, use <code>{'<img src="cid:{{qr_cid}}" alt="QR code" />'}</code>.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-300/80">
          <span>Manual recipients: {manualRecipients.length}</span>
          <span>{fileInputRef.current?.files?.length ? 'CSV attached' : 'No CSV file'}</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="submit" disabled={isUploading} className="primary-button disabled:opacity-60">
            {isUploading ? 'Queueing…' : 'Queue emails'}
          </button>
          <button
            type="button"
            onClick={handleSendNow}
            disabled={isSending}
            className="secondary-button disabled:opacity-60"
          >
            {isSending ? 'Sending…' : 'Send queued now'}
          </button>
        </div>
      </form>

      {lastReport && (
        <div className="space-y-3 text-xs text-slate-200/85">
          {lastReport.type === 'queue' && (
            <>
              <p>
                Last queued {lastReport.queued} recipient{lastReport.queued === 1 ? '' : 's'} at {lastReport.at.toLocaleTimeString()}.
              </p>
              {lastReport.details?.length ? (
                <ul className="max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-3 font-mono text-[11px]">
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
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="font-semibold text-slate-100">
                Last send run at {lastReport.at.toLocaleTimeString()}:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-slate-300/85">
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
