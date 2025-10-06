import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client.js';
import SeatMap from '../components/SeatMap.jsx';
import StatCard from '../components/StatCard.jsx';
import TrendSparkline from '../components/TrendSparkline.jsx';
import { useAnalytics } from '../contexts/AnalyticsContext.jsx';

const DEFAULT_EVENT_ID = Number(import.meta.env.VITE_DEFAULT_EVENT_ID || 1);

const statusColors = {
  available: 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400',
  reserved: 'bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400',
  sold: 'bg-gradient-to-r from-slate-500 via-slate-600 to-slate-800',
  blocked: 'bg-gradient-to-r from-rose-500 via-red-500 to-amber-500'
};

function DashboardPage() {
  const { snapshot, isConnected, lastUpdated, isLoading: analyticsLoading } = useAnalytics();
  const analyticsEvents = snapshot?.events ?? [];

  const [eventId, setEventId] = useState(DEFAULT_EVENT_ID || analyticsEvents[0]?.id || 1);
  const [pendingEventId, setPendingEventId] = useState(() => String(DEFAULT_EVENT_ID || analyticsEvents[0]?.id || 1));
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSeats = useCallback(async (id) => {
    if (!id) return;
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
    if (!analyticsEvents.length) return;
    if (analyticsEvents.some((event) => event.id === eventId)) return;
    const fallbackId = analyticsEvents[0]?.id;
    if (fallbackId) {
      setEventId(fallbackId);
      setPendingEventId(String(fallbackId));
    }
  }, [analyticsEvents, eventId]);

  useEffect(() => {
    if (!eventId) return;
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

  const eventAnalytics = useMemo(
    () => analyticsEvents.find((event) => event.id === eventId) ?? null,
    [analyticsEvents, eventId]
  );

  const seatInsights = eventAnalytics?.seats ?? stats;
  const occupancyPercentage = eventAnalytics?.occupancy != null
    ? Math.round(eventAnalytics.occupancy * 100)
    : null;
  const checkInsWindow = eventAnalytics?.checkIns ?? { lastFiveMinutes: 0, lastHour: 0, history: [] };

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
      <section className="glass-panel flex flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="glass-section-label">Live command center</p>
            <h2 className="page-heading">Event administration</h2>
            <p className="page-subheading">
              Track seat inventory, check-ins, and engagement in real time for event #{eventId}.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:w-auto md:flex-row md:items-end">
            {analyticsEvents.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="input-label" htmlFor="eventSelect">
                  Select event
                </label>
                <select
                  id="eventSelect"
                  value={eventId}
                  onChange={(evt) => {
                    const nextId = Number(evt.target.value);
                    if (!Number.isNaN(nextId)) {
                      setEventId(nextId);
                      setPendingEventId(String(nextId));
                    }
                  }}
                  className="input-field min-w-[16rem] appearance-none"
                >
                  {analyticsEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                      {event.startsAt ? ` • ${new Date(event.startsAt).toLocaleString()}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <form onSubmit={handleLoadEvent} className="flex items-end gap-3">
              <div className="flex flex-col gap-2">
                <label className="input-label" htmlFor="eventId">
                  Event ID
                </label>
                <input
                  id="eventId"
                  type="number"
                  min="1"
                  value={pendingEventId}
                  onChange={handleEventChange}
                  className="input-field w-24"
                />
              </div>
              <button type="submit" className="primary-button whitespace-nowrap">
                Load
              </button>
            </form>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200/70">
          <span
            className={`inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-semibold uppercase tracking-[0.3em] ${
              isConnected ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/5 text-slate-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-300 animate-pulse' : 'bg-slate-400'}`} />
            {isConnected ? 'stream live' : 'stream paused'}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1 tracking-[0.3em]">
            updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
          </span>
          {analyticsLoading && <span className="rounded-full border border-white/10 px-3 py-1">Syncing analytics…</span>}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-5">
        <StatCard
          label="Capacity"
          value={eventAnalytics?.capacity ?? '—'}
          accent="bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500"
        />
        <StatCard label="Available" value={seatInsights.available ?? 0} accent={statusColors.available} />
        <StatCard label="Reserved" value={seatInsights.reserved ?? 0} accent={statusColors.reserved} />
        <StatCard label="Sold" value={seatInsights.sold ?? 0} accent={statusColors.sold} />
        <StatCard
          label="Occupancy"
          value={occupancyPercentage != null ? `${occupancyPercentage}%` : '—'}
          accent="bg-gradient-to-r from-emerald-400 via-green-500 to-lime-500"
        />
      </section>

       <section className="grid gap-6 xl:grid-cols-[10fr]">
        <div className="glass-panel px-4 py-6">
          <SeatMap seats={seats} isLoading={loading} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="glass-card p-6">
          <p className="glass-section-label">System load</p>
          <h3 className="text-lg font-semibold text-white">Email queue overview</h3>
          <ul className="mt-4 space-y-2 text-sm text-slate-200/85">
            <li className="flex items-center justify-between">
              <span>Pending</span>
              <span>{snapshot?.queue?.pending ?? 0}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Sending</span>
              <span>{snapshot?.queue?.sending ?? 0}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Sent (today)</span>
              <span>{snapshot?.queue?.sent ?? 0}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Failed</span>
              <span>{snapshot?.queue?.failed ?? 0}</span>
            </li>
          </ul>
        </div>
        <div className="glass-card p-6">
          <p className="glass-section-label">Global metrics</p>
          <h3 className="text-lg font-semibold text-white">Portfolio overview</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-200/85">
            <div className="flex items-center justify-between">
              <span>Events live</span>
              <span>{snapshot?.totals?.events ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tickets checked-in (hour)</span>
              <span>{snapshot?.totals?.checkIns?.lastHour ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tickets active</span>
              <span>{snapshot?.totals?.tickets?.active ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total revenue</span>
              <span>
                ₱
                {(snapshot?.totals?.revenue ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </span>
            </div>
          </div>
        </div>
        <div className="glass-card p-6">
          <p className="glass-section-label">High-occupancy alerts</p>
          <h3 className="text-lg font-semibold text-white">Events nearing capacity</h3>
          <div className="mt-4 space-y-4">
            {analyticsEvents
              .slice()
              .sort((a, b) => (b.occupancy ?? 0) - (a.occupancy ?? 0))
              .slice(0, 3)
              .map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-200/90">
                    <span className="font-semibold text-white">{event.name}</span>
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {event.occupancy != null ? `${Math.round(event.occupancy * 100)}%` : '—'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                    <span>Available: {event.seats?.available ?? 0}</span>
                    <span>Sold: {event.seats?.sold ?? 0}</span>
                    <span>Reserved: {event.seats?.reserved ?? 0}</span>
                  </div>
                </div>
              ))}
            {analyticsEvents.length === 0 && (
              <p className="text-sm text-slate-300/80">No events found.</p>
            )}
          </div>
        </div>
        <div className="glass-card flex h-full flex-col justify-between gap-6 p-6">
          <div className="space-y-2">
            <p className="glass-section-label">Realtime insights</p>
            <h3 className="text-lg font-semibold text-white">Check-in velocity</h3>
            <p className="text-sm text-slate-200/80">
              Live check-ins for the last hour (5-minute cadence). Use this to anticipate entrance staffing.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-200/80">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Last 5 minutes</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{checkInsWindow.lastFiveMinutes ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Last hour</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{checkInsWindow.lastHour ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <TrendSparkline data={checkInsWindow.history ?? []} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
