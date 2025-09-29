import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client.js';
import SeatMap from '../components/SeatMap.jsx';
import BulkEmailUploader from '../components/BulkEmailUploader.jsx';
import StatCard from '../components/StatCard.jsx';

const DEFAULT_EVENT_ID = Number(import.meta.env.VITE_DEFAULT_EVENT_ID || 1);

const statusColors = {
  available: 'bg-emerald-500/60',
  reserved: 'bg-amber-500/60',
  sold: 'bg-slate-900',
  blocked: 'bg-rose-500/60'
};

function DashboardPage() {
  const [eventId, setEventId] = useState(DEFAULT_EVENT_ID);
  const [pendingEventId, setPendingEventId] = useState(DEFAULT_EVENT_ID.toString());
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoAssignQty, setAutoAssignQty] = useState(1);
  const [autoAssignResult, setAutoAssignResult] = useState(null);

  const loadSeats = useCallback(async (id) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/events/${id}/seats`);
      setSeats(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to load seats');
      setSeats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSeats(eventId);
  }, [eventId, loadSeats]);

  const stats = useMemo(() => {
    const totals = seats.reduce(
      (acc, seat) => {
        acc[seat.status] = (acc[seat.status] || 0) + 1;
        acc.total += 1;
        return acc;
      },
      { total: 0 }
    );
    return totals;
  }, [seats]);

  const handleEventChange = (evt) => {
    setPendingEventId(evt.target.value);
  };

  const handleLoadEvent = (evt) => {
    evt.preventDefault();
    const parsed = Number(pendingEventId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      alert('Event ID must be a positive number');
      return;
    }
    setEventId(parsed);
  };

  const handleAutoAssign = async (evt) => {
    evt.preventDefault();
    const qty = Number(autoAssignQty);
    if (!Number.isInteger(qty) || qty < 1) {
      alert('Quantity must be at least 1');
      return;
    }

    try {
      const result = await apiFetch(`/api/admin/events/${eventId}/auto-assign`, {
        method: 'POST',
        body: JSON.stringify({ qty })
      });
      setAutoAssignResult(result);
      await loadSeats(eventId);
      alert(`Reserved ${result.reserved.length} seats until ${new Date(result.reservedUntil).toLocaleTimeString()}`);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to reserve seats');
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-white px-6 py-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Event Administration</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manage seat inventory, reservations, and outbound communications for event #{eventId}.
          </p>
        </div>
        <form onSubmit={handleLoadEvent} className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600" htmlFor="eventId">
            Event ID
          </label>
          <input
            id="eventId"
            type="number"
            min="1"
            value={pendingEventId}
            onChange={handleEventChange}
            className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
          <button
            type="submit"
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
          >
            Load
          </button>
        </form>
      </section>

      <section className="grid gap-5 md:grid-cols-4">
        <StatCard label="Total seats" value={stats.total ?? '—'} accent="bg-brand" />
        <StatCard label="Available" value={stats.available ?? 0} accent={statusColors.available} />
        <StatCard label="Reserved" value={stats.reserved ?? 0} accent={statusColors.reserved} />
        <StatCard label="Sold" value={stats.sold ?? 0} accent={statusColors.sold} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <SeatMap seats={seats} isLoading={loading} />
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800">Auto assign contiguous seats</h3>
            <p className="mt-2 text-sm text-slate-500">
              Quickly reserve seats for walk-ins or manual processing.
            </p>
            <form onSubmit={handleAutoAssign} className="mt-4 space-y-4">
              <div>
                <label htmlFor="qty" className="text-sm font-medium text-slate-600">
                  Quantity
                </label>
                <input
                  id="qty"
                  type="number"
                  min="1"
                  value={autoAssignQty}
                  onChange={(evt) => setAutoAssignQty(evt.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                Reserve block
              </button>
            </form>
            {autoAssignResult && (
              <div className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
                <p>
                  Reserved seats:
                  <span className="ml-1 font-medium text-slate-900">
                    {autoAssignResult.reserved.join(', ')}
                  </span>
                </p>
                <p>Token: {autoAssignResult.reservedToken}</p>
                <p>Expires: {new Date(autoAssignResult.reservedUntil).toLocaleString()}</p>
              </div>
            )}
          </div>

          <BulkEmailUploader eventId={eventId} onQueued={() => loadSeats(eventId)} />
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
