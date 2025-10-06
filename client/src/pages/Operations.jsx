import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client.js';
import BulkEmailUploader from '../components/BulkEmailUploader.jsx';
import StatCard from '../components/StatCard.jsx';

const DEFAULT_EVENT_ID = Number(import.meta.env.VITE_DEFAULT_EVENT_ID || 1);

const statusColors = {
  available: 'bg-gradient-to-r from-emerald-400 to-teal-500',
  reserved: 'bg-gradient-to-r from-amber-400 to-orange-500',
  sold: 'bg-gradient-to-r from-indigo-500 to-purple-600',
  blocked: 'bg-gradient-to-r from-rose-500 to-red-500'
};

function OperationsPage() {
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
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <section className="glass-panel flex flex-col gap-6 px-8 py-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <p className="glass-section-label">Operations Center</p>
          <h2 className="page-heading">Seat management toolkit</h2>
          <p className="page-subheading">
            Reserve contiguous seats, trigger bulk email queues, and monitor live capacity for event #{eventId}.
          </p>
        </div>
        <form onSubmit={handleLoadEvent} className="glass-card flex w-full max-w-sm flex-col gap-4 p-5 md:w-auto">
          <div className="flex flex-col gap-2">
            <label className="input-label" htmlFor="operations-event">
              Event ID
            </label>
            <input
              id="operations-event"
              type="number"
              min="1"
              value={pendingEventId}
              onChange={handleEventChange}
              className="input-field"
            />
          </div>
          <button type="submit" className="primary-button justify-center">
            Load event
          </button>
        </form>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total seats" value={stats.total ?? '—'} />
        <StatCard label="Available" value={stats.available ?? 0} accent={statusColors.available} />
        <StatCard label="Reserved" value={stats.reserved ?? 0} accent={statusColors.reserved} />
        <StatCard label="Sold" value={stats.sold ?? 0} accent={statusColors.sold} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="glass-card space-y-4 p-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-white">Auto assign contiguous seats</h3>
            <p className="text-sm text-slate-200/80">
              Quickly reserve blocks for walk-ins or manual handling with a single click.
            </p>
          </div>
          <form onSubmit={handleAutoAssign} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="operations-qty" className="input-label">
                Quantity
              </label>
              <input
                id="operations-qty"
                type="number"
                min="1"
                value={autoAssignQty}
                onChange={(evt) => setAutoAssignQty(evt.target.value)}
                className="input-field"
              />
            </div>
            <button type="submit" className="primary-button w-full disabled:opacity-60" disabled={loading}>
              {loading ? 'Working…' : 'Reserve block'}
            </button>
          </form>
          {autoAssignResult && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200/90">
              <p className="font-semibold text-slate-100">Reserved seats</p>
              <p className="mt-1 text-slate-200">
                {autoAssignResult.reserved.join(', ')}
              </p>
              <div className="mt-2 space-y-1 text-slate-300">
                <p>Token: {autoAssignResult.reservedToken}</p>
                <p>Expires: {new Date(autoAssignResult.reservedUntil).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        <BulkEmailUploader eventId={eventId} onQueued={() => loadSeats(eventId)} />
      </section>
    </div>
  );
}

export default OperationsPage;
