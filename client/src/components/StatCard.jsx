function StatCard({ label, value, accent = 'bg-brand' }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold text-slate-900`}>{value}</p>
      <span className={`mt-4 inline-block h-1 w-12 rounded-full ${accent}`}></span>
    </div>
  );
}

export default StatCard;
