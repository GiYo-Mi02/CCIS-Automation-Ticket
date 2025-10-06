import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client.js';
import SeatMap from '../components/SeatMap.jsx';
import StatCard from '../components/StatCard.jsx';

const DEFAULT_EVENT_ID = Number(import.meta.env.VITE_DEFAULT_EVENT_ID || 1);

const statusColors = {
  available: 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400',
  reserved: 'bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400',
  sold: 'bg-gradient-to-r from-slate-500 via-slate-600 to-slate-800',
  blocked: 'bg-gradient-to-r from-rose-500 via-red-500 to-amber-500'
};

function DashboardPage() {
  const [eventId, setEventId] = useState(DEFAULT_EVENT_ID);
  const [pendingEventId, setPendingEventId] = useState(DEFAULT_EVENT_ID.toString());
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="glass-panel flex flex-col gap-6 px-6 py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="page-heading">Event Administration</h2>
          <p className="page-subheading">
            Manage seat inventory, reservations, and communications for event #{eventId}.
          </p>
        </div>
        <form onSubmit={handleLoadEvent} className="flex items-center gap-3">
          <label className="input-label" htmlFor="eventId">
            Event ID
          </label>
          <input
            id="eventId"
            type="number"
            min="1"
            value={pendingEventId}
            onChange={handleEventChange}
            className="input-field w-28"
          />
          <button type="submit" className="primary-button">
            Load
          </button>
        </form>
      </section>

      <section className="grid gap-5 md:grid-cols-4">
        <StatCard
          label="Total seats"
          value={stats.total ?? '—'}
          accent="bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500"
        />
        <StatCard label="Available" value={stats.available ?? 0} accent={statusColors.available} />
        <StatCard label="Reserved" value={stats.reserved ?? 0} accent={statusColors.reserved} />
        <StatCard label="Sold" value={stats.sold ?? 0} accent={statusColors.sold} />
      </section>

      <section className="glass-panel px-4 py-6">
        <SeatMap seats={seats} isLoading={loading} />
      </section>
    </div>
  );
}

export default DashboardPage;
