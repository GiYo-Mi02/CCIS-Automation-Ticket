import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../api/client.js';

const DEFAULT_SUBJECT_TEMPLATE = 'Your Ticket for {{event}}';
const DEFAULT_BODY_TEMPLATE = `<!doctype html>
<p>Hi {{name}},</p>
<p>We're excited to see you at <strong>{{event}}</strong>.</p>
<ul>
  <li><strong>Student Section:</strong> {{student_section}}</li>
  <li><strong>Seat:</strong> {{seat}}</li>
  <li><strong>Ticket Code:</strong> {{ticket_code}}</li>
  <li><strong>Starts:</strong> {{event_starts}}</li>
</ul>
<p>Show this QR code at the entrance:</p>
<p><img src="cid:{{qr_cid}}" alt="Ticket QR" style="max-width:260px" /></p>
<p>If you have any questions, reply to this email.</p>`;

function BulkEmailUploader({ eventId, onQueued }) {
  const fileInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [manualEntries, setManualEntries] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [subjectTemplate, setSubjectTemplate] = useState(DEFAULT_SUBJECT_TEMPLATE);
  const [bodyTemplate, setBodyTemplate] = useState(DEFAULT_BODY_TEMPLATE);
  const [usePoster, setUsePoster] = useState(false);
  const [hasPoster, setHasPoster] = useState(null);
  const manualRecipients = useMemo(() => parseLines(manualEntries), [manualEntries]);

  // Detect if current event has a poster
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const events = await apiFetch('/api/admin/events');
        const current = Array.isArray(events) ? events.find((e) => e.id === Number(eventId)) : null;
        if (!cancelled) setHasPoster(Boolean(current?.poster_url));
      } catch (_) {
        if (!cancelled) setHasPoster(null);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId]);

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

    // If user wants poster but none is available and no banner file attached, warn
    const bannerFile = bannerInputRef.current?.files?.[0] || null;
    if (usePoster && hasPoster === false && !bannerFile) {
      const proceed = confirm('This event has no poster set. Upload a banner image or uncheck "Use event poster as banner". Continue anyway?');
      if (!proceed) return;
    }

    setIsUploading(true);
    try {
      // Prepare multipart form-data for optional banner upload
      const form = new FormData();
      form.append('event_id', String(eventId));
      form.append('list', JSON.stringify(recipients));
      form.append('subject', subjectTemplate);
      form.append('bodyTemplate', bodyTemplate);
      if (usePoster) form.append('use_poster', 'true');
      if (bannerFile) form.append('banner', bannerFile);

      const data = await apiFetch('/api/admin/emails/bulk', {
        method: 'POST',
        body: form,
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
    <div className="flex h-full flex-col gap-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">Bulk email queue</p>
        <h3 className="text-lg font-semibold text-gray-900">Ticket delivery automation</h3>
        <p className="text-sm text-gray-600">
          Upload a CSV or paste recipients to queue personalized tickets. Seats are auto-assigned in order starting at Row A · Seat 1.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">CSV upload</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-sky-500 file:via-indigo-500 file:to-purple-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500">Optional banner image</label>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-xl file:border-0 file:bg-gradient-to-r file:from-emerald-500 file:via-teal-500 file:to-cyan-500 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
            />
            <p className="text-xs text-gray-500">If provided, this image will be embedded inline as a banner.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500" htmlFor="use-poster">
              Use event poster as banner
            </label>
            <div className="flex items-center gap-2">
              <input
                id="use-poster"
                type="checkbox"
                checked={usePoster}
                onChange={(e) => setUsePoster(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-xs text-gray-600">If checked (and no banner file uploaded), the event poster will be embedded.</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500" htmlFor="manual-list">
            Manual entries
          </label>
          <textarea
            id="manual-list"
            rows="4"
            value={manualEntries}
            onChange={(e) => setManualEntries(e.target.value)}
            placeholder={['user@example.com', 'another@example.com'].join('\n')}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <p className="text-xs text-gray-500">
            Separate entries with new lines. Use: email,name,student_section. Name and section are optional.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500" htmlFor="subject-template">
            Email subject template
          </label>
          <input
            id="subject-template"
            type="text"
            value={subjectTemplate}
            onChange={(e) => setSubjectTemplate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <p className="text-xs text-gray-500">
            Use tokens like <code>{'{{event}}'}</code>, <code>{'{{student_section}}'}</code>, <code>{'{{seat}}'}</code>, <code>{'{{ticket_code}}'}</code>.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.25em] text-gray-500" htmlFor="body-template">
            Email body template (HTML supported)
          </label>
          <textarea
            id="body-template"
            rows="8"
            value={bodyTemplate}
            onChange={(e) => setBodyTemplate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <div className="space-y-1 text-xs text-gray-500">
            <p>
              Available placeholders: <code>{'{{name}}'}</code>, <code>{'{{email}}'}</code>, <code>{'{{student_section}}'}</code>, <code>{'{{event}}'}</code>, <code>{'{{seat}}'}</code>, <code>{'{{ticket_code}}'}</code>, <code>{'{{qr_cid}}'}</code>, <code>{'{{qr_data_url}}'}</code>, <code>{'{{event_starts}}'}</code>, <code>{'{{poster_cid}}'}</code>, <code>{'{{poster_url}}'}</code>.
            </p>
            <p>
              To embed the QR inline, use <code>{'<img src="cid:{{qr_cid}}" alt="QR code" />'}</code>.
            </p>
            <p>
              To embed the banner/poster inline, use <code>{'<img src="cid:{{poster_cid}}" alt="Banner" />'}</code> (or reference <code>{'{{poster_url}}'}</code> for a remote URL).
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Manual recipients: {manualRecipients.length}</span>
          <span>
            {(fileInputRef.current?.files?.length ? 'CSV attached' : 'No CSV file')}
            {bannerInputRef.current?.files?.length ? ' · Banner attached' : ''}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            disabled={isUploading}
            className="rounded-lg bg-gray-900 px-4 py-2 font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploading ? 'Queueing…' : 'Queue emails'}
          </button>
          <button
            type="button"
            onClick={handleSendNow}
            disabled={isSending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? 'Sending…' : 'Send queued now'}
          </button>
        </div>
      </form>

      {lastReport && (
        <div className="space-y-3 text-xs text-gray-600">
          {lastReport.type === 'queue' && (
            <>
              <p>
                Last queued {lastReport.queued} recipient{lastReport.queued === 1 ? '' : 's'} at {lastReport.at.toLocaleTimeString()}.
              </p>
              {lastReport.details?.length ? (
                <ul className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-[11px] text-gray-700">
                  {lastReport.details.map((item) => (
                    <li key={`${item.email}-${item.ticketCode}`}>
                      {item.email} → {item.seat} ({item.ticketCode}){item.studentSection ? ` • ${item.studentSection}` : ''}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}

          {lastReport.type === 'send' && lastReport.result && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="font-semibold text-gray-900">
                Last send run at {lastReport.at.toLocaleTimeString()}:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-gray-700">
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

  if (lines.length === 0) return [];

  const parsedRows = lines.map(parseCsvLine);
  const headerRow = parsedRows[0].map((value) => normalizeHeader(value));
  const emailIndex = findIndexByKeywords(headerRow, ['email', 'e-mail', 'mail']);
  const nameIndex = findIndexByKeywords(headerRow, ['name', 'full name', 'fullname']);
  const sectionIndex = findIndexByKeywords(headerRow, ['section', 'year and section', 'yr', 'block']);

  const hasHeader = emailIndex >= 0;
  const rows = hasHeader ? parsedRows.slice(1) : parsedRows;

  if (hasHeader) {
    return rows
      .map((row) => {
        const email = (row[emailIndex] || '').trim();
        const name = nameIndex >= 0 ? (row[nameIndex] || '').trim() : '';
        const section = sectionIndex >= 0 ? (row[sectionIndex] || '').trim() : '';
        if (!email) return null;
        return { email, name, section };
      })
      .filter(Boolean);
  }

  const recipients = [];
  for (const row of parsedRows) {
    const [emailRaw = '', nameRaw = '', sectionRaw = ''] = row;
    const email = emailRaw?.trim();
    if (!email) continue;
    recipients.push({
      email,
      name: nameRaw.trim(),
      section: sectionRaw.trim(),
    });
  }
  return recipients;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findIndexByKeywords(headers, keywords) {
  return headers.findIndex((header) =>
    keywords.some((keyword) => header.includes(keyword))
  );
}

export default BulkEmailUploader;
