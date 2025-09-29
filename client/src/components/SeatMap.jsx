import { useMemo } from 'react';

const statusStyles = {
  available: 'bg-emerald-100 text-emerald-800 border border-emerald-500/40',
  reserved: 'bg-amber-100 text-amber-800 border border-amber-500/40',
  sold: 'bg-slate-800 text-white border border-slate-900/60',
  blocked: 'bg-slate-200 text-slate-500 border border-slate-300'
};

function SeatMap({ seats, isLoading }) {
  const groupedRows = useMemo(() => {
    const map = new Map();
    seats.forEach((seat) => {
      if (!map.has(seat.row_label)) {
        map.set(seat.row_label, []);
      }
      map.get(seat.row_label).push(seat);
    });

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true })).map(
      ([rowLabel, rowSeats]) => ({
        rowLabel,
        seats: rowSeats.sort((a, b) => a.col_idx - b.col_idx)
      })
    );
  }, [seats]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
        <p className="text-sm text-slate-500">Loading seats…</p>
      </div>
    );
  }

  if (!seats.length) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
        <p className="text-sm text-slate-500">No seats found for this event.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-700">Seat Map</h3>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {Object.entries(statusStyles).map(([status, className]) => (
            <div key={status} className="flex items-center gap-2">
              <span className={`block h-3 w-3 rounded ${className}`}></span>
              <span className="capitalize">{status}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto px-4 py-4 text-sm">
        <div className="space-y-3">
          {groupedRows.map(({ rowLabel, seats: rowSeats }) => (
            <div key={rowLabel}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Row {rowLabel}
              </div>
              <div className="flex flex-wrap gap-1">
                {rowSeats.map((seat) => (
                  <div
                    key={seat.id}
                    title={`${rowLabel}-${seat.seat_number}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold ${
                      statusStyles[seat.status] || 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {seat.seat_number}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SeatMap;
