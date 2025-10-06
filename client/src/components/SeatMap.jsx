import { useMemo } from 'react';

const STATUS_LEGEND = [
  { key: 'available', label: 'Available' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'sold', label: 'Sold' },
  { key: 'blocked', label: 'Blocked' }
];

const STATUS_OVERLAY_CLASSES = {
  available: 'shadow-[0_0_0_1px_rgba(255,255,255,0.35)]',
  reserved:
    'shadow-[0_0_0_1px_rgba(255,255,255,0.28)] ring-2 ring-amber-300/80 ring-offset-[1px] ring-offset-slate-950/80',
  sold: 'bg-slate-900/90 text-slate-200 shadow-[0_0_0_1px_rgba(15,23,42,0.65)]',
  blocked: 'bg-slate-700/85 text-slate-400 shadow-inner shadow-black/40'
};

const STATUS_LEGEND_STYLES = {
  available: 'bg-slate-200/80 shadow-[0_0_0_1px_rgba(255,255,255,0.4)]',
  reserved: 'bg-slate-200/80 ring-2 ring-amber-300/70 shadow-[0_0_0_1px_rgba(255,255,255,0.3)]',
  sold: 'bg-slate-800/80 shadow-[0_0_0_1px_rgba(15,23,42,0.6)]',
  blocked: 'bg-slate-600/80 shadow-inner shadow-black/40'
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

const SLICE_THEMES = {
  lowerBalcony: [
    {
      panel: 'border border-rose-400/35 bg-gradient-to-br from-pink-500/20 via-rose-500/15 to-orange-400/20',
      badge: 'bg-amber-200/80 text-slate-900',
      seatBase: 'bg-gradient-to-br from-pink-500 to-orange-400',
      seatText: 'text-slate-900',
      seatBorder: 'shadow-[0_0_0_1px_rgba(255,255,255,0.4)]'
    },
    {
      panel: 'border border-fuchsia-400/35 bg-gradient-to-br from-fuchsia-500/20 via-rose-500/15 to-pink-400/20',
      badge: 'bg-rose-200/80 text-white',
      seatBase: 'bg-gradient-to-br from-rose-500 to-fuchsia-500',
      seatText: 'text-white',
      seatBorder: 'shadow-[0_0_0_1px_rgba(255,255,255,0.35)]'
    }
  ],
  orchestra: [
    {
      panel: 'border border-violet-400/35 bg-gradient-to-br from-violet-600/20 via-purple-600/15 to-indigo-500/20',
      badge: 'bg-violet-200/80 text-slate-900',
      seatBase: 'bg-gradient-to-br from-violet-500 to-indigo-500',
      seatText: 'text-white',
      seatBorder: 'shadow-[0_0_0_1px_rgba(200,200,255,0.35)]'
    },
    {
      panel: 'border border-indigo-400/35 bg-gradient-to-br from-indigo-500/20 via-sky-500/12 to-blue-500/20',
      badge: 'bg-sky-200/80 text-slate-900',
      seatBase: 'bg-gradient-to-br from-indigo-500 to-sky-500',
      seatText: 'text-white',
      seatBorder: 'shadow-[0_0_0_1px_rgba(190,210,255,0.32)]'
    },
    {
      panel: 'border border-sky-400/35 bg-gradient-to-br from-sky-500/20 via-blue-500/15 to-violet-500/20',
      badge: 'bg-sky-200/75 text-slate-900',
      seatBase: 'bg-gradient-to-br from-sky-500 to-violet-500',
      seatText: 'text-white',
      seatBorder: 'shadow-[0_0_0_1px_rgba(180,220,255,0.3)]'
    },
    {
      panel: 'border border-blue-400/35 bg-gradient-to-br from-blue-500/20 via-indigo-500/15 to-slate-500/25',
      badge: 'bg-blue-200/80 text-slate-900',
      seatBase: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      seatText: 'text-white',
      seatBorder: 'shadow-[0_0_0_1px_rgba(170,200,255,0.32)]'
    }
  ],
  lodges: [
    {
      panel: 'border border-cyan-400/35 bg-gradient-to-br from-cyan-500/22 via-blue-500/15 to-sky-500/20',
      badge: 'bg-cyan-200/80 text-slate-900',
      seatBase: 'bg-gradient-to-br from-cyan-500 to-blue-500',
      seatText: 'text-white',
      seatBorder: 'shadow-[0_0_0_1px_rgba(180,230,245,0.32)]'
    },
    {
      panel: 'border border-teal-400/35 bg-gradient-to-br from-teal-500/22 via-emerald-500/15 to-cyan-500/18',
      badge: 'bg-teal-200/80 text-slate-900',
      seatBase: 'bg-gradient-to-br from-teal-500 to-cyan-500',
      seatText: 'text-white',
      seatBorder: 'shadow-[0_0_0_1px_rgba(170,235,225,0.3)]'
    }
  ],
  upperBalcony: [
    {
      panel: 'border border-amber-400/35 bg-gradient-to-br from-amber-500/22 via-orange-500/15 to-rose-400/20',
      badge: 'bg-amber-200/85 text-slate-900',
      seatBase: 'bg-gradient-to-br from-amber-500 to-rose-500',
      seatText: 'text-slate-900',
      seatBorder: 'shadow-[0_0_0_1px_rgba(255,240,200,0.4)]'
    },
    {
      panel: 'border border-orange-400/35 bg-gradient-to-br from-orange-500/22 via-rose-500/15 to-pink-500/20',
      badge: 'bg-orange-200/85 text-slate-900',
      seatBase: 'bg-gradient-to-br from-orange-500 to-pink-500',
      seatText: 'text-slate-900',
      seatBorder: 'shadow-[0_0_0_1px_rgba(255,225,190,0.38)]'
    }
  ]
};

function SeatMap({ seats, isLoading }) {
  const venueLayout = useMemo(() => buildVenueLayout(seats), [seats]);

  if (isLoading) {
    return (
      <div className="glass-card flex h-64 items-center justify-center border border-dashed border-white/15 text-sm text-slate-200/85">
        Loading seat map…
      </div>
    );
  }

  if (!venueLayout.totalSeats) {
    return (
      <div className="glass-card flex h-64 items-center justify-center border border-dashed border-white/15 text-sm text-slate-200/85">
        No seats found for this event.
      </div>
    );
  }

  return (
    <div className="glass-panel relative overflow-hidden p-6 text-slate-100">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-wide text-white">Seat Map Overview</h3>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Venue layout</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200/85">
          {STATUS_LEGEND.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2">
              <span className={`inline-flex h-4 w-6 items-center justify-center rounded-sm ${STATUS_LEGEND_STYLES[key]}`}></span>
              <span className="capitalize text-slate-200/85">{label}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="mt-6 flex justify-center">
        <div className="rounded-full border border-white/15 bg-white/10 px-8 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-slate-200 shadow-inner shadow-black/40">
          Stage
        </div>
      </div>

      <div className="mt-8 max-h-[70vh] overflow-auto pr-2">
        {['lowerBalcony', 'orchestra', 'lodges', 'upperBalcony'].map((groupKey) => {
          const slices = venueLayout.groups[groupKey];
          if (!slices || slices.length === 0) {
            return null;
          }

          return (
            <section key={groupKey} className="mb-10 last:mb-0">
              <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.45em] text-slate-500">
                {GROUP_TITLES[groupKey]}
              </h4>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${slices.length}, minmax(0, 1fr))` }}
              >
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
    <div
      className={`relative overflow-hidden rounded-2xl p-4 shadow-[0_25px_55px_-35px_rgba(15,23,42,0.95)] transition-shadow duration-300 hover:shadow-[0_35px_65px_-30px_rgba(59,130,246,0.35)] ${slice.theme.panel}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h5 className="text-sm font-semibold text-white drop-shadow-[0_1px_3px_rgba(15,23,42,0.6)]">
            {slice.displayName}
          </h5>
          <p className="text-[0.65rem] uppercase tracking-[0.4em] text-slate-200/60">
            {slice.seatCount} seats
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-[0.55rem] uppercase tracking-[0.35em] ${slice.theme.badge}`}>
          {slice.rows.length} rows
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {slice.rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-[0.6rem] uppercase tracking-[0.35em] text-slate-200/70">
              {row.label}
            </span>
            <div className="flex flex-wrap gap-1">
              {row.seats.map((seat) => (
                <SeatToken key={seat.id} seat={seat} theme={slice.theme} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SeatToken({ seat, theme }) {
  const status = seat?.status || 'available';
  const shouldColorize = status === 'available' || status === 'reserved';
  const seatClass = shouldColorize ? `${theme.seatBase} ${theme.seatText}` : 'bg-slate-600/70 text-slate-200';
  const overlay = STATUS_OVERLAY_CLASSES[status] || STATUS_OVERLAY_CLASSES.available;
  const label = formatSeatLabel(seat);
  const title = `${seat?.section || 'Section'} ${seat?.row_label || ''} Seat ${seat?.seat_number} • ${status}`;

  return (
    <div
      title={title}
      className={`relative flex h-7 w-7 items-center justify-center rounded-md text-[0.55rem] font-semibold uppercase tracking-tight transition-transform duration-150 hover:scale-105 ${seatClass} ${theme.seatBorder} ${overlay}`}
    >
      <span className="relative z-[1] drop-shadow-[0_1px_2px_rgba(15,23,42,0.45)]">{label}</span>
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
      const themes = SLICE_THEMES[groupKey];

      const slices = labels.map((label, idx) => ({
        displayName: label,
        theme: themes[idx % themes.length],
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
