interface StatCardProps {
  label: string
  value: string
  unit: string
  subtitle?: string
  color?: string
}

export function StatCard({ label, value, unit, subtitle, color = '#4A9EFF' }: StatCardProps) {
  return (
    <div className="stat-card bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color }}>{value}</span>
        <span className="text-sm text-slate-400">{unit}</span>
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>}
    </div>
  )
}
