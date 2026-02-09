import type { ReactNode } from 'react'

export function ChartContainer({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: ReactNode; className?: string
}) {
  return (
    <figure role="figure" aria-label={title}
      className={`bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 ${className}`}>
      <figcaption className="mb-4">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </figcaption>
      {children}
    </figure>
  )
}
