import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client.js';
import BulkEmailUploader from '../components/BulkEmailUploader.jsx';

const DEFAULT_EVENT_ID = Number(import.meta.env.VITE_DEFAULT_EVENT_ID || 1);

function OperationsPage() {
  const [eventId, setEventId] = useState(DEFAULT_EVENT_ID);
  const [pendingEventId, setPendingEventId] = useState(DEFAULT_EVENT_ID.toString());
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoAssignQty, setAutoAssignQty] = useState(1);
  const [autoAssignResult, setAutoAssignResult] = useState(null);
  const [createForm, setCreateForm] = useState({ seat_id: '', user_email: '', user_name: '', price: '' });

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
        const status = seat?.status || 'available';
        if (acc[status] === undefined) {
          acc[status] = 0;
        }
        acc[status] += 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, available: 0, reserved: 0, sold: 0, blocked: 0 }
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

    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const engagedSeats = stats.sold + stats.reserved;
  const occupancyPercent = stats.total ? Math.round((engagedSeats / stats.total) * 100) : 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <section className="bg-white shadow-sm border border-gray-200 rounded-xl flex flex-col gap-6 p-6 md:p-8 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-500">Operations Center</p>
          <h2 className="text-2xl font-semibold text-gray-900">Seat management toolkit</h2>
          <p className="text-sm text-gray-500 mt-1 max-w-md">
            Reserve contiguous seats, trigger bulk email queues, and monitor live capacity for event #{eventId}.
          </p>
        </div>
        <form onSubmit={handleLoadEvent} className="bg-gray-50 border border-gray-100 rounded-xl flex w-full max-w-sm flex-col gap-4 p-5 md:w-auto">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="operations-event">
              Event ID
            </label>
            <input
              id="operations-event"
              type="number"
              min="1"
              value={pendingEventId}
              onChange={handleEventChange}
              className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2 w-full block"
            />
          </div>
          <button type="submit" className="bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 px-4 py-2 rounded-lg transition-colors font-medium shadow-sm flex justify-center w-full block">
            Load event
          </button>
        </form>
      </section>

      <section className="bg-white shadow-sm border border-gray-200 rounded-xl flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Occupancy insight</p>
          <h3 className="text-lg font-semibold text-gray-900 mt-1">{occupancyPercent}% of seats engaged</h3>
          <p className="text-sm text-gray-500 mt-1">
            {stats.total ? `${engagedSeats} of ${stats.total} seats are reserved or sold for event #${eventId}.` : 'Load an event to view occupancy breakdown.'}
          </p>
        </div>
        <div className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-gray-200 mt-2 sm:mt-0">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, occupancyPercent))}%` }}
          />
        </div>
      </section>

      {/* Ticketing tools section */}
      <section className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Ticketing tools</p>
          <h3 className="text-lg font-semibold text-gray-900 mt-1">Manual issuing and seat utilities</h3>
        </div>
        <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2">
          <div className="bg-white shadow-sm border border-gray-200 rounded-xl h-full space-y-5 p-6 flex flex-col">
            <div className="space-y-1 mt-1">
              <h3 className="text-lg font-semibold text-gray-900">Create ticket (manual)</h3>
              <p className="text-sm text-gray-500">Issue a single ticket to a specified seat and email.</p>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const seatId = Number(createForm.seat_id);
                if (!Number.isInteger(seatId) || seatId <= 0) {
                  alert('Seat ID must be a positive number');
                  return;
                }
                if (!createForm.user_email.trim()) {
                  alert('Email is required');
                  return;
                }
                try {
                  await apiFetch('/api/admin/tickets/create', {
                    method: 'POST',
                    body: JSON.stringify({
                      event_id: eventId,
                      seat_id: seatId,
                      user_email: createForm.user_email.trim(),
                      user_name: createForm.user_name.trim() || undefined,
                      price: createForm.price !== '' ? Number(createForm.price) : undefined,
                    }),
                  });
                  setCreateForm({ seat_id: '', user_email: '', user_name: '', price: '' });
                  await loadSeats(eventId);
                  alert('Ticket created');
                } catch (err) {
                  console.error(err);
                  alert(err.message || 'Failed to create ticket');
                }
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="create-seat" className="text-sm font-medium text-gray-700">Seat ID</label>
                  <input
                    id="create-seat"
                    type="number"
                    min="1"
                    value={createForm.seat_id}
                    onChange={(e) => setCreateForm((p) => ({ ...p, seat_id: e.target.value }))}
                    className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2.5 w-full block"
                    placeholder="e.g. 1234"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-price" className="text-sm font-medium text-gray-700">Price (optional)</label>
                  <input
                    id="create-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={createForm.price}
                    onChange={(e) => setCreateForm((p) => ({ ...p, price: e.target.value }))}
                    className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2.5 w-full block"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="create-email" className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    id="create-email"
                    type="email"
                    value={createForm.user_email}
                    onChange={(e) => setCreateForm((p) => ({ ...p, user_email: e.target.value }))}
                    className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2.5 w-full block"
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-name" className="text-sm font-medium text-gray-700">Name (optional)</label>
                  <input
                    id="create-name"
                    type="text"
                    value={createForm.user_name}
                    onChange={(e) => setCreateForm((p) => ({ ...p, user_name: e.target.value }))}
                    className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2.5 w-full block"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>
              <button type="submit" className="bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 w-full rounded-lg px-4 py-2 mt-2 font-medium transition-colors shadow-sm">Issue ticket</button>
            </form>
          </div>

          <div className="bg-white shadow-sm border border-gray-200 rounded-xl h-full space-y-5 p-6 flex flex-col">
            <div className="space-y-1 mt-1">
              <h3 className="text-lg font-semibold text-gray-900">Auto assign contiguous seats</h3>
              <p className="text-sm text-gray-500">
                Quickly reserve blocks for walk-ins or manual handling with a single click.
              </p>
            </div>
            <form onSubmit={handleAutoAssign} className="space-y-5 mt-2">
              <div className="space-y-1.5">
                <label htmlFor="operations-qty" className="text-sm font-medium text-gray-700">
                  Quantity
                </label>
                <input
                  id="operations-qty"
                  type="number"
                  min="1"
                  value={autoAssignQty}
                  onChange={(evt) => setAutoAssignQty(evt.target.value)}
                  className="bg-white border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 px-3 py-2.5 w-full block max-w-xs"
                />
              </div>
              <button type="submit" className="bg-gray-900 text-white hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 w-full max-w-xs rounded-lg px-4 py-2 font-medium transition-colors disabled:opacity-60 shadow-sm" disabled={loading}>
                {loading ? 'Working…' : 'Reserve block'}
              </button>
            </form>
            {autoAssignResult && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 mt-2">
                <p className="font-semibold text-blue-900 text-sm">Reserved seats</p>
                <p className="mt-1 text-sm text-blue-800 font-medium break-all">
                  {autoAssignResult.reserved.join(', ')}
                </p>
                <div className="mt-3 space-y-1 text-xs text-blue-700">
                  <p>Token: {autoAssignResult.reservedToken}</p>
                  <p>Expires: {new Date(autoAssignResult.reservedUntil).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Communications section */}
      <section className="space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Communications</p>
          <h3 className="text-lg font-semibold text-gray-900 mt-1">Bulk email queue</h3>
        </div>
        <BulkEmailUploader eventId={eventId} onQueued={() => loadSeats(eventId)} />
      </section>
    </div>
  );
}

export default OperationsPage;
