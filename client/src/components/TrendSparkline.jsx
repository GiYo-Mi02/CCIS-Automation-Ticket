function TrendSparkline({ data = [], height = 80, stroke = '#38bdf8', fill = 'rgba(56,189,248,0.18)' }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center text-xs text-slate-300/70">
        Waiting for live activity…
      </div>
    );
  }

  const counts = data.map((item) => Number(item.count) || 0);
  const max = Math.max(...counts, 1);
  const min = 0;
  const range = max - min || 1;
  const normalized = counts.map((value) => (value - min) / range);
  const pointCount = normalized.length;

  const points = normalized.map((value, index) => {
    const x = pointCount > 1 ? (index / (pointCount - 1)) * 100 : 100;
    const y = 100 - value * 100;
    return `${x},${y}`;
  });

  const areaPath = `M0,100 ${points.map((pt) => `L${pt}`).join(' ')} L100,100 Z`;
  const linePath = `M${points[0]} ${points.slice(1).map((pt) => `L${pt}`).join(' ')}`;

  const firstLabel = data[0]?.bucket ? new Date(data[0].bucket).toLocaleTimeString() : '';
  const lastLabel = data[data.length - 1]?.bucket
    ? new Date(data[data.length - 1].bucket).toLocaleTimeString()
    : '';

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-32 w-full"
        style={{ maxHeight: height }}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={fill} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#spark-fill)" stroke="none" vectorEffect="non-scaling-stroke" />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-slate-400">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

export default TrendSparkline;
