import { useMemo } from 'react';

const STATUS_LEGEND = [
  { key: 'available', label: 'Available' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'sold', label: 'Sold' },
  { key: 'blocked', label: 'Blocked' }
];

const STATUS_LEGEND_STYLES = {
  available: 'bg-white border border-gray-200',
  reserved: 'bg-yellow-100 border border-yellow-300',
  sold: 'bg-blue-600 border border-blue-600',
  blocked: 'bg-gray-100 border border-gray-200'
};

const SEAT_CLASSES = {
  available: 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-gray-50',
  reserved: 'bg-yellow-100 border-2 border-yellow-300 text-yellow-800 hover:bg-yellow-200',
  sold: 'bg-blue-600 border-2 border-blue-600 text-white cursor-default',
  blocked: 'bg-gray-100 border-2 border-gray-200 text-gray-400 cursor-not-allowed'
};

const GROUP_TITLES = {
  lowerBalcony: 'Lower Balcony',
  orchestra: 'Orchestra',
  lodges: 'Lodges',
  upperBalcony: 'Upper Balcony'
};

const SLICE_CONFIG = {
  lowerBalcony: {
    labels: ['Lower Balcony (Left)', 'Lower Balcony (Right)']
  },
  orchestra: {
    labels: [
      'Orchestra (Left)',
      'Orchestra (Left Center)',
      'Orchestra (Right Center)',
      'Orchestra (Right)'
    ]
  },
  lodges: {
    labels: ['Lodge (Left)', 'Lodge (Right)']
  },
  upperBalcony: {
    labels: ['Upper Balcony (Left)', 'Upper Balcony (Right)']
  }
};

function getGridColumnsClass(length) {
  if (length === 1) return 'md:grid-cols-1';
  if (length === 2) return 'md:grid-cols-2';
  if (length === 3) return 'md:grid-cols-3';
  return 'md:grid-cols-4';
}

function SeatMap({ seats, isLoading }) {
  const venueLayout = useMemo(() => buildVenueLayout(seats), [seats]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex h-64 items-center justify-center text-sm font-medium text-gray-500">
        Loading seat map…
      </div>
    );
  }

  if (!venueLayout.totalSeats) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex h-64 items-center justify-center text-sm font-medium text-gray-500">
        No seats found for this event.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden p-6 md:p-8 text-gray-900">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Seat Map Overview</h3>
          <p className="text-sm font-medium text-gray-500 mt-1">Venue layout</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-gray-600">
          {STATUS_LEGEND.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`inline-flex h-4 w-6 items-center justify-center rounded ${STATUS_LEGEND_STYLES[key]}`}></span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="mt-8 flex justify-center">
        <div className="rounded-lg border-2 border-gray-200 bg-gray-50 px-12 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">
          Stage
        </div>
      </div>

      {/* Adding overflow-x-auto handles small screens gracefully, but flex-col is the core response */}
      <div className="mt-8 md:max-h-[70vh] overflow-auto md:pr-2">
        {['lowerBalcony', 'orchestra', 'lodges', 'upperBalcony'].map((groupKey) => {
          const slices = venueLayout.groups[groupKey];
          if (!slices || slices.length === 0) {
            return null;
          }

          const gridClass = getGridColumnsClass(slices.length);

          return (
            <section key={groupKey} className="mb-10 last:mb-0">
              <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-400">
                {GROUP_TITLES[groupKey]}
              </h4>
              <div className={`flex flex-col gap-4 md:grid ${gridClass}`}>
                {slices.map((slice) => (
                  <SliceCard key={slice.key} slice={slice} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SliceCard({ slice }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
        <div>
          <h5 className="text-sm font-semibold text-gray-900">
            {slice.displayName}
          </h5>
          <p className="text-xs font-medium text-gray-500 mt-0.5">
            {slice.seatCount} seats
          </p>
        </div>
        <div className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-gray-600">
          {slice.rows.length} rows
        </div>
      </div>

      {/* Overflow-x-auto allows wide rows to scroll horizontally inside their card instead of breaking layout */}
      <div className="space-y-3 overflow-x-auto pb-2">
        {slice.rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-8 shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">
              {row.label}
            </span>
            <div className="flex flex-nowrap md:flex-wrap gap-1.5 w-max">
              {row.seats.map((seat) => (
                <SeatToken key={seat.id} seat={seat} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeatToken({ seat }) {
  const status = seat?.status || 'available';
  const seatClass = SEAT_CLASSES[status] || SEAT_CLASSES.available;
  const label = formatSeatLabel(seat);
  const title = `${seat?.section || 'Section'} ${seat?.row_label || ''} Seat ${seat?.seat_number} • ${status}`;

  return (
    <div
      title={title}
      className={`relative shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-[0.6rem] font-bold uppercase tracking-tight transition-transform duration-100 ease-in ${seatClass}`}
    >
      <span className="relative z-[1]">{label}</span>
    </div>
  );
}

function buildVenueLayout(seats) {
  if (!Array.isArray(seats) || seats.length === 0) {
    return {
      totalSeats: 0,
      groups: {
        lowerBalcony: [],
        orchestra: [],
        lodges: [],
        upperBalcony: []
      }
    };
  }

  const rowBuckets = new Map();

  seats.forEach((seat) => {
    const rowIdx = Number.isFinite(seat.row_idx) ? seat.row_idx : 0;
    if (!rowBuckets.has(rowIdx)) {
      rowBuckets.set(rowIdx, {
        idx: rowIdx,
        label: resolveRowLabel(seat),
        seats: []
      });
    }
    rowBuckets.get(rowIdx).seats.push(seat);
  });

  const rows = Array.from(rowBuckets.values()).sort((a, b) => a.idx - b.idx);
  const totalRows = rows.length;

  const groupSlices = createGroupSlices();

  rows.forEach((row, rowOrderIndex) => {
    const rowFraction = totalRows > 1 ? rowOrderIndex / (totalRows - 1) : 0;
    const sortedSeats = row.seats
      .slice()
      .sort((a, b) => (toNumber(a.col_idx) - toNumber(b.col_idx)) || (toNumber(a.seat_number) - toNumber(b.seat_number)));

    const seatCountInRow = sortedSeats.length;

    sortedSeats.forEach((seat, seatIndex) => {
      const colFraction = seatCountInRow > 1 ? seatIndex / (seatCountInRow - 1) : 0.5;
      const region = classifyRegion(rowFraction, colFraction);
      const containers = groupSlices[region.groupKey];
      if (!containers) {
        return;
      }

      const sliceIndex = clamp(region.sliceIndex, 0, containers.length - 1);
      const slice = containers[sliceIndex];
      slice.seatCount += 1;

      if (!slice.rows.has(row.label)) {
        slice.rows.set(row.label, {
          label: row.label,
          rowIdx: row.idx,
          seats: []
        });
      }

      const bucket = slice.rows.get(row.label);
      bucket.seats.push(seat);
    });
  });

  const groups = Object.fromEntries(
    Object.entries(groupSlices).map(([groupKey, slices]) => {
      const hydratedSlices = slices
        .map((slice, index) => ({
          ...slice,
          key: `${groupKey}-${index}`,
          displayName: slice.displayName,
          rows: Array.from(slice.rows.values())
            .map((row) => ({
              ...row,
              seats: row.seats
                .slice()
                .sort((a, b) => (toNumber(a.col_idx) - toNumber(b.col_idx)) || (toNumber(a.seat_number) - toNumber(b.seat_number)))
            }))
            .sort((a, b) => a.rowIdx - b.rowIdx)
        }))
        .filter((slice) => slice.seatCount > 0);

      return [groupKey, hydratedSlices];
    })
  );

  return {
    totalSeats: seats.length,
    groups
  };
}

function createGroupSlices() {
  return Object.fromEntries(
    Object.keys(SLICE_CONFIG).map((groupKey) => {
      const labels = SLICE_CONFIG[groupKey].labels;

      const slices = labels.map((label, idx) => ({
        displayName: label,
        seatCount: 0,
        rows: new Map()
      }));

      return [groupKey, slices];
    })
  );
}

function classifyRegion(rowFraction, colFraction) {
  const rowValue = clamp(isFinite(rowFraction) ? rowFraction : 0, 0, 1);
  const colValue = clamp(isFinite(colFraction) ? colFraction : 0.5, 0, 1);

  if (rowValue <= 0.22) {
    return { groupKey: 'lowerBalcony', sliceIndex: colValue < 0.5 ? 0 : 1 };
  }

  if (rowValue <= 0.60) {
    if (colValue < 0.22) return { groupKey: 'orchestra', sliceIndex: 0 };
    if (colValue < 0.5) return { groupKey: 'orchestra', sliceIndex: 1 };
    if (colValue < 0.78) return { groupKey: 'orchestra', sliceIndex: 2 };
    return { groupKey: 'orchestra', sliceIndex: 3 };
  }

  if (rowValue <= 0.78) {
    return { groupKey: 'lodges', sliceIndex: colValue < 0.5 ? 0 : 1 };
  }

  return { groupKey: 'upperBalcony', sliceIndex: colValue < 0.5 ? 0 : 1 };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function resolveRowLabel(seat) {
  if (seat && typeof seat.row_label === 'string' && seat.row_label.trim()) {
    return seat.row_label.trim();
  }
  const idx = Number.isFinite(seat?.row_idx) ? seat.row_idx + 1 : 0;
  return idx ? `Row ${idx}` : 'Row';
}

function formatSeatLabel(seat) {
  if (!seat) return '';
  const rowLabel = seat.row_label ? seat.row_label.trim() : '';
  const seatNo = seat.seat_number != null ? String(seat.seat_number) : '';
  if (rowLabel && seatNo) {
    return `${rowLabel}${seatNo}`;
  }
  return seatNo || rowLabel || '';
}

export default SeatMap;
