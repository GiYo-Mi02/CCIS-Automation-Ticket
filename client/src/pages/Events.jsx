import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  PhotoIcon,
  PlusIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import { apiFetch } from '../api/client.js';

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
  const [formState, setFormState] = useState(initialFormState);
  const fileInputRef = useRef(null);
  const localPreviewRef = useRef(null);

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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="rounded-3xl bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Manage Events</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Publish new events, update schedules, and manage promotional posters. Changes sync instantly with the
              admin dashboard and scanners.
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
          >
            <PlusIcon className="h-4 w-4" />
            New event
          </button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1.2fr]">
        <div className="space-y-4">
          {loading ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              Loading events…
            </div>
          ) : sortedEvents.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
              No events yet. Create your first event using the form.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sortedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onEdit={populateForm}
                  isActive={formState.id === event.id}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800">
              {isEditing ? 'Update event' : 'Create new event'}
            </h3>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Cancel edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600" htmlFor="event-name">
                Event name
              </label>
              <input
                id="event-name"
                type="text"
                value={formState.name}
                onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                placeholder="e.g. CCIS Recognition Night"
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600" htmlFor="event-start">
                  Starts
                </label>
                <input
                  id="event-start"
                  type="datetime-local"
                  value={formState.starts_at}
                  onChange={(e) => setFormState((prev) => ({ ...prev, starts_at: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-600" htmlFor="event-end">
                  Ends
                </label>
                <input
                  id="event-end"
                  type="datetime-local"
                  value={formState.ends_at}
                  onChange={(e) => setFormState((prev) => ({ ...prev, ends_at: e.target.value }))}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600" htmlFor="event-capacity">
                Capacity
              </label>
              <input
                id="event-capacity"
                type="number"
                min="0"
                value={formState.capacity}
                onChange={(e) => setFormState((prev) => ({ ...prev, capacity: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                placeholder="1196"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600" htmlFor="event-description">
                Description
              </label>
              <textarea
                id="event-description"
                rows="3"
                value={formState.description}
                onChange={(e) => setFormState((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                placeholder="Highlight key details attendees should know."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">Poster</label>
              <div className="flex items-start gap-4">
                <div className="flex h-32 w-24 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
                  {formState.posterPreview ? (
                    <img src={formState.posterPreview} alt="Event poster" className="h-full w-full object-cover" />
                  ) : (
                    <PhotoIcon className="h-10 w-10 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 space-y-3 text-sm text-slate-600">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePosterChange}
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-dark"
                  />
                  <p className="text-xs text-slate-500">Maximum size 5MB. JPG or PNG recommended.</p>
                  {(formState.posterPreview || formState.posterUrl) && (
                    <button
                      type="button"
                      onClick={handleRemovePoster}
                      className="text-xs font-semibold text-rose-500 hover:underline"
                    >
                      Remove poster
                    </button>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
            >
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

function EventCard({ event, onEdit, isActive }) {
  const starts = formatDateTime(event.starts_at || event.performance_at);
  const ends = formatDateTime(event.ends_at);
  const posterSrc = resolvePosterUrl(event.poster_url);

  return (
    <div
      className={`relative h-full rounded-xl border ${
        isActive ? 'border-brand ring-2 ring-brand/40' : 'border-slate-200'
      } bg-white p-5 shadow-sm transition hover:shadow-md`}
    >
      <div className="flex gap-4">
        <div className="h-32 w-24 overflow-hidden rounded-lg bg-slate-100">
          {posterSrc ? (
            <img src={posterSrc} alt={`${event.name} poster`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-200 text-xs uppercase tracking-wide text-slate-500">
              No poster
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <div>
            <h4 className="text-base font-semibold text-slate-900">{event.name}</h4>
            <p className="text-xs text-slate-500">Capacity: {event.capacity ?? '—'}</p>
          </div>
          <div className="space-y-1 text-xs text-slate-600">
            {starts && <p>Starts: {starts}</p>}
            {ends && <p>Ends: {ends}</p>}
          </div>
          {event.description && (
            <p className="text-sm text-slate-600">
              {event.description.length > 160
                ? `${event.description.slice(0, 157)}...`
                : event.description}
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => onEdit(event)}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand hover:text-brand"
        >
          <PencilSquareIcon className="h-4 w-4" />
          Edit
        </button>
      </div>
    </div>
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

function resolvePosterUrl(posterUrl) {
  if (!posterUrl) return null;
  if (/^https?:\/\//i.test(posterUrl)) {
    return posterUrl;
  }
  return `${API_BASE}${posterUrl}`;
}

export default EventsPage;
