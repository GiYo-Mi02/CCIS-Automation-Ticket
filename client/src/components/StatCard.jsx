function StatCard({ label, value, accent = 'bg-gradient-to-r from-sky-400 via-indigo-400 to-blue-500' }) {
  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-300/70">{label}</p>
        <span className={`h-2 w-10 rounded-full ${accent}`}></span>
      </div>
      <p className="mt-4 text-4xl font-semibold tracking-tight text-white drop-shadow-[0_10px_25px_rgba(56,189,248,0.3)]">
        {value}
      </p>
    </div>
  );
}

export default StatCard;
