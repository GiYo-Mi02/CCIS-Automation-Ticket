import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  PhotoIcon,
  PlusIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { apiFetch } from '../api/client.js';
import StatCard from '../components/StatCard.jsx';
import { useAnalytics } from '../contexts/analytics-context.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const initialFormState = {
  id: null,
  name: '',
  description: '',
  starts_at: '',
  ends_at: '',
  capacity: '',
  posterFile: null,
  posterPreview: null,
  posterUrl: null,
  removePoster: false,
};

function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [formState, setFormState] = useState(initialFormState);
  const fileInputRef = useRef(null);
  const localPreviewRef = useRef(null);
  const { snapshot } = useAnalytics();

  const analyticsEvents = snapshot?.events ?? [];
  const analyticsById = useMemo(() => {
    const map = {};
    analyticsEvents.forEach((event) => {
      map[event.id] = event;
    });
    return map;
  }, [analyticsEvents]);

  const globalTotals = snapshot?.totals ?? null;

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/admin/events');
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to load events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    return () => {
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
      }
    };
  }, []);

  const handlePosterChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    localPreviewRef.current = previewUrl;

    setFormState((prev) => ({
      ...prev,
      posterFile: file,
      posterPreview: previewUrl,
      posterUrl: null,
      removePoster: false,
    }));
  };

  const resetForm = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    setFormState(initialFormState);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Scroll to form on mobile when creating a new event
    document.getElementById('event-form-container')?.scrollIntoView({ behavior: 'smooth' });
  };

  const populateForm = (event) => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }

    const startsInput = event.starts_at || event.performance_at;
    const endsInput = event.ends_at;

    setFormState({
      id: event.id,
      name: event.name ?? '',
      description: event.description ?? '',
      starts_at: toInputDate(startsInput),
      ends_at: toInputDate(endsInput),
      capacity: event.capacity ?? '',
      posterFile: null,
      posterPreview: resolvePosterUrl(event.poster_url),
      posterUrl: event.poster_url ?? null,
      removePoster: false,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Scroll to form on mobile when editing
    document.getElementById('event-form-container')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRemovePoster = () => {
    if (localPreviewRef.current) {
      URL.revokeObjectURL(localPreviewRef.current);
      localPreviewRef.current = null;
    }
    setFormState((prev) => ({
      ...prev,
      posterFile: null,
      posterPreview: null,
      posterUrl: null,
      removePoster: true,
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!formState.name.trim()) {
      alert('Event name is required');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', formState.name.trim());
      formData.append('description', formState.description);
      if (formState.starts_at) formData.append('starts_at', formState.starts_at);
      if (formState.ends_at) formData.append('ends_at', formState.ends_at);
      if (formState.capacity !== '') formData.append('capacity', Number(formState.capacity));
      if (formState.posterFile) formData.append('poster', formState.posterFile);
      if (formState.removePoster && !formState.posterFile) {
        formData.append('poster_url', '');
      }

      const method = formState.id ? 'PUT' : 'POST';
      const url = formState.id
        ? `/api/admin/events/${formState.id}`
        : '/api/admin/events';

      await apiFetch(url, { method, body: formData });
      await loadEvents();
      resetForm();
      alert(`Event ${formState.id ? 'updated' : 'created'} successfully`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const aDate = new Date(a.starts_at || a.performance_at || a.created_at || 0).getTime();
      const bDate = new Date(b.starts_at || b.performance_at || b.created_at || 0).getTime();
      return bDate - aDate;
    });
  }, [events]);

  const isEditing = Boolean(formState.id);

  const handleExport = useCallback((eventId, format) => {
    if (!eventId) return;
    const supported = ['csv', 'xlsx', 'pdf'];
    if (!supported.includes(format)) return;

    const url = `${API_BASE}/api/admin/events/${eventId}/attendees/export.${format}`;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, []);

  const handleDelete = useCallback(async (event) => {
    if (!event?.id) return;
    const confirmed = window.confirm(
      `Delete event "${event.name}" and all its tickets? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      setDeletingId(event.id);
      await apiFetch(`/api/admin/events/${event.id}`, { method: 'DELETE' });
      if (formState.id === event.id) {
        setFormState(initialFormState);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
      await loadEvents();
      alert('Event deleted');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  }, [formState.id, loadEvents]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8">
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">Event portfolio</p>
            <h2 className="text-2xl font-semibold text-gray-900">Manage events</h2>
            <p className="text-sm text-gray-500 max-w-2xl mt-1">
              Publish new events, update schedules, and oversee collateral with live occupancy and attendance data to guide your campaigns.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
            <span className="rounded-full bg-gray-50 border border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
              Live events · {analyticsEvents.length}
            </span>
            <button type="button" onClick={resetForm} className="bg-gray-900 text-white hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors font-medium flex items-center justify-center gap-2 shadow-sm">
              <PlusIcon className="h-4 w-4" />
              New event
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 grid-cols-2 md:grid-cols-4">
        <StatCard
          label="Events online"
          value={analyticsEvents.length}
          accent="bg-gray-50 text-gray-900 border border-gray-100"
        />
        <StatCard
          label="Tickets sold"
          value={(globalTotals?.tickets?.total ?? 0) - (globalTotals?.tickets?.cancelled ?? 0)}
          accent="bg-blue-50 text-blue-700"
        />
        <StatCard
          label="Check-ins (hour)"
          value={globalTotals?.checkIns?.lastHour ?? 0}
          accent="bg-green-50 text-green-700"
        />
        <StatCard
          label="Revenue"
          value={`₱${(globalTotals?.revenue ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          accent="bg-gray-50 text-gray-900 border border-gray-100"
        />
      </section>

      {/* On mobile, stack flex-col-reverse so form is below if requested, but flex-col places the right sidebar on top/bottom. Grid reverses order nicely. */}
      <section className="flex flex-col-reverse lg:grid lg:grid-cols-[1.7fr_1.1fr] gap-6">
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex h-40 items-center justify-center text-sm text-gray-500">
              Loading events…
            </div>
          ) : sortedEvents.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex h-40 items-center justify-center text-sm text-gray-500">
              No events yet. Create your first event using the form.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-1">
              {sortedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  analytics={analyticsById[event.id]}
                  onEdit={populateForm}
                  onExport={handleExport}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  isActive={formState.id === event.id}
                />
              ))}
            </div>
          )}
        </div>

        <div id="event-form-container" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5 lg:sticky lg:top-8 h-max">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Update event' : 'Create new event'}
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Cancel edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="event-name">
                Event name
              </label>
              <input
                id="event-name"
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 w-full block"
                placeholder="e.g. CCIS Recognition Night"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="event-start">
                  Starts
                </label>
                <input
                  id="event-start"
                  type="datetime-local"
                  value={formState.starts_at}
                  onChange={(e) => setFormState((prev) => ({ ...prev, starts_at: e.target.value }))}
                  className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 w-full block"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="event-end">
                  Ends
                </label>
                <input
                  id="event-end"
                  type="datetime-local"
                  value={formState.ends_at}
                  onChange={(e) => setFormState((prev) => ({ ...prev, ends_at: e.target.value }))}
                  className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 w-full block"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="event-capacity">
                Capacity
              </label>
              <input
                id="event-capacity"
                type="number"
                min="0"
                value={formState.capacity}
                onChange={(e) => setFormState((prev) => ({ ...prev, capacity: e.target.value }))}
                className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 w-full block"
                placeholder="1196"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="event-description">
                Description
              </label>
              <textarea
                id="event-description"
                rows="3"
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 w-full block resize-y"
                placeholder="Highlight key details attendees should know."
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-gray-700">Poster</span>
              <div className="flex items-start gap-4">
                <div className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50 aspect-[3/4]">
                  {formState.posterPreview ? (
                    <img src={formState.posterPreview} alt="Event poster" className="h-full w-full object-cover" />
                  ) : (
                    <PhotoIcon className="h-8 w-8 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 space-y-3 text-sm text-gray-600 pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePosterChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-900 hover:file:bg-gray-200 focus:outline-none"
                  />
                  <p className="text-xs text-gray-500">Maximum size 5MB. JPG or PNG recommended.</p>
                  {(formState.posterPreview || formState.posterUrl) && (
                    <button
                      type="button"
                      onClick={handleRemovePoster}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove poster
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button type="submit" disabled={saving} className="bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 w-full rounded-lg px-4 py-2 font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm">
              {saving ? (
                <>
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <PencilSquareIcon className="h-4 w-4" />
                  {isEditing ? 'Update event' : 'Create event'}
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function EventCard({ event, onEdit, onExport, onDelete, deletingId, isActive, analytics }) {
  const starts = formatDateTime(event.starts_at || event.performance_at);
  const ends = formatDateTime(event.ends_at);
  const posterSrc = resolvePosterUrl(event.poster_url);
  const seats = analytics?.seats ?? { available: null, reserved: null, sold: null };
  const tickets = analytics?.tickets ?? { active: null, used: null, cancelled: null, revenue: null };
  const checkIns = analytics?.checkIns ?? { lastFiveMinutes: null, lastHour: null };
  const occupancyPercent = analytics?.occupancy != null ? Math.round(analytics.occupancy * 100) : null;
  const occupancyWidth = occupancyPercent != null ? `${Math.max(0, Math.min(occupancyPercent, 100))}%` : '0%';
  const occupancyLabel = occupancyPercent != null ? `${occupancyPercent}% full` : 'No live occupancy data';

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border transition duration-200 relative flex h-full flex-col gap-6 p-6 hover:shadow-md ${
        isActive ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="w-full shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50 sm:w-32 aspect-[3/4] sm:aspect-auto sm:h-44">
          {posterSrc ? (
            <img src={posterSrc} alt={`${event.name} poster`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-medium uppercase tracking-widest text-gray-400">
              Poster
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <h4 className="text-xl font-semibold text-gray-900">{event.name}</h4>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Capacity · {event.capacity ?? '—'}
            </p>
          </div>
          <div className="grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
            {starts && (
              <EventMetaRow indicator="bg-blue-500" label="Starts" value={starts} />
            )}
            {ends && (
              <EventMetaRow indicator="bg-purple-500" label="Ends" value={ends} />
            )}
          </div>
          {event.description && (
            <p className="text-sm leading-relaxed text-gray-600">
              {event.description.length > 180
                ? `${event.description.slice(0, 177)}…`
                : event.description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-5 mt-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Live metrics</p>
            <h5 className="text-lg font-semibold text-gray-900 mt-1">{occupancyLabel}</h5>
          </div>
          <div className="w-full max-w-xs self-start sm:self-auto">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: occupancyWidth }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <EventStatPill label="Seats sold" value={formatCompact(seats.sold)} />
          <EventStatPill label="Seats reserved" value={formatCompact(seats.reserved)} />
          <EventStatPill label="Seats open" value={formatCompact(seats.available)} />
          <EventStatPill label="Tickets used" value={formatCompact(tickets.used)} />
          <EventStatPill label="Tickets active" value={formatCompact(tickets.active)} />
          <EventStatPill label="Cancelled" value={formatCompact(tickets.cancelled)} />
          <EventStatPill label="Check-ins (5m)" value={formatCompact(checkIns.lastFiveMinutes)} />
          <EventStatPill label="Check-ins (1h)" value={formatCompact(checkIns.lastHour)} />
          <EventStatPill label="Revenue" value={formatCurrency(tickets.revenue)} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton label="CSV" onClick={() => onExport(event.id, 'csv')} />
          <ExportButton label="Excel" onClick={() => onExport(event.id, 'xlsx')} />
          <ExportButton label="PDF" onClick={() => onExport(event.id, 'pdf')} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(event)}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <PencilSquareIcon className="h-4 w-4" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(event)}
            disabled={deletingId === event.id}
            className="flex items-center gap-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            title="Delete event"
          >
            {deletingId === event.id ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventStatPill({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 shadow-none transition-colors hover:bg-gray-100">
      <p className="text-xs font-medium text-gray-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-gray-900">
        {value}
      </p>
    </div>
  );
}

function EventMetaRow({ indicator, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs text-gray-700">
      <span className={`mt-1.5 inline-flex h-2 w-2 rounded-full shrink-0 ${indicator}`} />
      <div className="space-y-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
        <p className="font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function ExportButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
    >
      <ArrowDownTrayIcon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function toInputDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => `${num}`.padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatCompact(value) {
  if (value === null || value === undefined) return '—';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '—';
  if (numberValue === 0) return '0';
  return compactNumberFormatter.format(numberValue);
}

function formatCurrency(value) {
  if (value === null || value === undefined) return '—';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '—';
  return `₱${numberValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolvePosterUrl(posterUrl) {
  if (!posterUrl) return null;
  if (/^https?:\/\//i.test(posterUrl)) {
    return posterUrl;
  }
  return `${API_BASE}${posterUrl}`;
}

export default EventsPage;
