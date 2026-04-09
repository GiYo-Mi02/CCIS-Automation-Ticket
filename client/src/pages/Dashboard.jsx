import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client.js';
import SeatMap from '../components/SeatMap.jsx';
import StatCard from '../components/StatCard.jsx';
import TrendSparkline from '../components/TrendSparkline.jsx';
import { useAnalytics } from '../contexts/AnalyticsContext.jsx';

const DEFAULT_EVENT_ID = Number(import.meta.env.VITE_DEFAULT_EVENT_ID || 1);

const statusColors = {
  available: 'bg-green-100 text-green-800',
  reserved: 'bg-yellow-100 text-yellow-800',
  sold: 'bg-blue-100 text-blue-800',
  blocked: 'bg-red-100 text-red-800'
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
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col gap-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">Live command center</p>
            <h2 className="text-2xl font-semibold text-gray-900">Event administration</h2>
            <p className="text-sm text-gray-500 mt-1">
              Track seat inventory, check-ins, and engagement in real time for event #{eventId}.
            </p>
          </div>
          <div className="flex flex-col gap-4 md:w-auto md:flex-row md:items-end">
            {analyticsEvents.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700" htmlFor="eventSelect">
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
                  className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 min-w-[16rem]"
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
                <label className="text-sm font-medium text-gray-700" htmlFor="eventId">
                  Event ID
                </label>
                <input
                  id="eventId"
                  type="number"
                  min="1"
                  value={pendingEventId}
                  onChange={handleEventChange}
                  className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 w-24"
                />
              </div>
              <button type="submit" className="bg-gray-900 text-white hover:bg-gray-800 px-4 py-2 rounded-lg transition-colors whitespace-nowrap font-medium shadow-sm">
                Load
              </button>
            </form>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-medium ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {isConnected ? 'Stream Live' : 'Stream Paused'}
          </span>
          <span className="rounded-full bg-gray-100 text-gray-600 px-3 py-1 font-medium">
            Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
          </span>
          {analyticsLoading && <span className="rounded-full bg-blue-50 text-blue-600 px-3 py-1 font-medium">Syncing analytics…</span>}
        </div>
      </section>

      <section className="grid gap-5 grid-cols-2 md:grid-cols-5">
        <StatCard
          label="Capacity"
          value={eventAnalytics?.capacity ?? '—'}
          accent="bg-gray-100 text-gray-900"
        />
        <StatCard label="Available" value={seatInsights.available ?? 0} accent={statusColors.available} />
        <StatCard label="Reserved" value={seatInsights.reserved ?? 0} accent={statusColors.reserved} />
        <StatCard label="Sold" value={seatInsights.sold ?? 0} accent={statusColors.sold} />
        <StatCard
          label="Occupancy"
          value={occupancyPercentage != null ? `${occupancyPercentage}%` : '—'}
          accent="bg-primary-50 text-primary-700"
        />
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 overflow-hidden">
        <SeatMap seats={seats} isLoading={loading} />
      </section>

      <section className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">System load</p>
          <h3 className="text-lg font-semibold text-gray-900 mt-1">Email queue overview</h3>
          <ul className="mt-6 space-y-3 text-sm text-gray-600">
            <li className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="font-medium">Pending</span>
              <span className="text-gray-900">{snapshot?.queue?.pending ?? 0}</span>
            </li>
            <li className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="font-medium">Sending</span>
              <span className="text-gray-900">{snapshot?.queue?.sending ?? 0}</span>
            </li>
            <li className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="font-medium">Sent (today)</span>
              <span className="text-gray-900">{snapshot?.queue?.sent ?? 0}</span>
            </li>
            <li className="flex items-center justify-between py-1">
              <span className="font-medium">Failed</span>
              <span className="text-gray-900">{snapshot?.queue?.failed ?? 0}</span>
            </li>
          </ul>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <p className="text-sm font-medium text-gray-500">Global metrics</p>
          <h3 className="text-lg font-semibold text-gray-900 mt-1">Portfolio overview</h3>
          <ul className="mt-6 space-y-3 text-sm text-gray-600">
            <li className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="font-medium">Events live</span>
              <span className="text-gray-900">{snapshot?.totals?.events ?? 0}</span>
            </li>
            <li className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="font-medium">Tickets checked-in (hour)</span>
              <span className="text-gray-900">{snapshot?.totals?.checkIns?.lastHour ?? 0}</span>
            </li>
            <li className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="font-medium">Tickets active</span>
              <span className="text-gray-900">{snapshot?.totals?.tickets?.active ?? 0}</span>
            </li>
            <li className="flex items-center justify-between py-1">
              <span className="font-medium">Total revenue</span>
              <span className="text-gray-900 font-semibold">
                ₱
                {(snapshot?.totals?.revenue ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                })}
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
          <p className="text-sm font-medium text-gray-500">High-occupancy alerts</p>
          <h3 className="text-lg font-semibold text-gray-900 mt-1">Events nearing capacity</h3>
          <div className="mt-6 space-y-4 w-full">
            {analyticsEvents
              .slice()
              .sort((a, b) => (b.occupancy ?? 0) - (a.occupancy ?? 0))
              .slice(0, 3)
              .map((event) => (
                <div key={event.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-gray-900 truncate pr-2">{event.name}</span>
                    <span className="text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-md px-2 py-0.5 shrink-0">
                      {event.occupancy != null ? `${Math.round(event.occupancy * 100)}%` : '—'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <span>Avail: <span className="font-medium text-gray-700">{event.seats?.available ?? 0}</span></span>
                    <span>Sold: <span className="font-medium text-gray-700">{event.seats?.sold ?? 0}</span></span>
                    <span>Res: <span className="font-medium text-gray-700">{event.seats?.reserved ?? 0}</span></span>
                  </div>
                </div>
              ))}
            {analyticsEvents.length === 0 && (
              <p className="text-sm text-gray-500">No events found.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">Realtime insights</p>
            <h3 className="text-lg font-semibold text-gray-900">Check-in velocity</h3>
            <p className="text-sm text-gray-500">
              Live check-ins for the last hour (5-minute cadence). Use this to anticipate entrance staffing.
            </p>
          </div>
          <div className="flex flex-col gap-4 mt-6">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Last 5 min</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{checkInsWindow.lastFiveMinutes ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase">Last hour</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900">{checkInsWindow.lastHour ?? 0}</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <TrendSparkline data={checkInsWindow.history ?? []} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;
