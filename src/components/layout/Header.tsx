import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Global Overview' },
  { to: '/country', label: 'Country Explorer' },
  { to: '/commodity', label: 'Commodity Explorer' },
  { to: '/flows', label: 'Trade Flows' },
]

export function Header() {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
              F
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100 leading-tight">Food Transport Emissions</h1>
              <p className="text-xs text-slate-500 leading-tight">Global Analysis 2010–2024</p>
            </div>
          </div>
        </div>
        <nav className="flex gap-1 -mb-px overflow-x-auto" aria-label="Main navigation">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}
