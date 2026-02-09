import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { useData } from '../context/DataContext'
import { useDataLoader } from '../hooks/useDataLoader'
import type { Commodities, TransportFactors } from '../types/data'
import { StatCard } from '../components/shared/StatCard'
import { YearSlider } from '../components/shared/YearSlider'
import { ChartContainer } from '../components/shared/ChartContainer'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { formatEmissions, formatFoodMiles, formatDistance } from '../utils/formatters'
import { ROUTE_COLORS, MODE_COLORS } from '../utils/colors'

export function CommodityExplorer() {
  const { name: paramName } = useParams()
  const navigate = useNavigate()
  const { selectedYear, dropdownLists } = useData()
  const { data: commodities, loading } = useDataLoader<Commodities>('commodities.json')
  const { data: transportFactors } = useDataLoader<TransportFactors>('transport_factors.json')

  const [search, setSearch] = useState('')
  const commodity = paramName ? decodeURIComponent(paramName) : 'Wheat'

  const filtered = useMemo(() => {
    if (!dropdownLists) return []
    const q = search.toLowerCase()
    return dropdownLists.commodities
      .filter(c => c.toLowerCase().includes(q))
      .slice(0, 20)
  }, [dropdownLists, search])

  const yearStr = String(selectedYear)
  const commData = commodities?.[commodity]
  const yd = commData?.[yearStr]
  const bilTtw = yd?.bilateral?.ttw ?? 0
  const domTtw = yd?.domestic?.ttw ?? 0
  const totalTtw = bilTtw + domTtw
  const totalFm = (yd?.bilateral?.food_miles ?? 0) + (yd?.domestic?.food_miles ?? 0)

  // Time series
  const timeSeries = useMemo(() => {
    if (!commData) return []
    return Array.from({ length: 14 }, (_, i) => {
      const y = 2010 + i
      const d = commData[String(y)]
      return {
        year: y,
        Domestic: d?.domestic?.ttw ? Math.round(d.domestic.ttw / 1e3) : 0,
        International: d?.bilateral?.ttw ? Math.round(d.bilateral.ttw / 1e3) : 0,
      }
    })
  }, [commData])

  // Pie
  const pieData = [
    { name: 'Domestic', value: domTtw },
    { name: 'International', value: bilTtw },
  ]

  // Transport factors for this commodity
  const factors = useMemo(() => {
    if (!transportFactors) return []
    // Try exact match first, then partial match
    let tf = transportFactors[commodity]
    if (!tf) {
      const key = Object.keys(transportFactors).find(k =>
        k.toLowerCase().includes(commodity.toLowerCase().split(',')[0].split(' ')[0])
      )
      if (key) tf = transportFactors[key]
    }
    if (!tf) return []
    return Object.entries(tf)
      .map(([mode, data]) => ({
        mode: mode.charAt(0).toUpperCase() + mode.slice(1),
        modeKey: mode,
        ttw: data.ttw,
        distance: data.distance,
        routes: data.routes,
      }))
      .sort((a, b) => b.ttw - a.ttw)
  }, [transportFactors, commodity])

  // All commodities ranked for selected year
  const allRanked = useMemo(() => {
    if (!commodities) return { rank: 0, total: 0 }
    const sorted = Object.entries(commodities)
      .map(([name, data]) => {
        const d = data[yearStr]
        return { name, ttw: (d?.bilateral?.ttw ?? 0) + (d?.domestic?.ttw ?? 0) }
      })
      .sort((a, b) => b.ttw - a.ttw)
    const rank = sorted.findIndex(c => c.name === commodity) + 1
    return { rank, total: sorted.length }
  }, [commodities, commodity, yearStr])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Commodity selector */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search commodity..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                {filtered.map(c => (
                  <button key={c}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 text-slate-200"
                    onClick={() => { navigate(`/commodity/${encodeURIComponent(c)}`); setSearch('') }}>
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
          <YearSlider />
        </div>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-100">{commodity}</h2>
        <p className="text-sm text-slate-400 mt-1">
          {allRanked.rank > 0 ? `Ranked #${allRanked.rank} of ${allRanked.total} commodities by transport emissions` : 'Transport emissions analysis'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Emissions" value={formatEmissions(totalTtw)} unit="CO₂" />
        <StatCard label="International" value={formatEmissions(bilTtw)} unit="CO₂" color={ROUTE_COLORS.bilateral} />
        <StatCard label="Domestic" value={formatEmissions(domTtw)} unit="CO₂" color={ROUTE_COLORS.domestic} />
        <StatCard label="Food Miles" value={formatFoodMiles(totalFm)} unit="" color="#66CCEE" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartContainer title="Emissions Over Time" subtitle="Thousand tonnes CO₂" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" stroke="#64748B" fontSize={12} />
              <YAxis stroke="#64748B" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }} />
              <ReferenceLine x={selectedYear} stroke="#4A9EFF" strokeDasharray="4 4" strokeWidth={2} />
              <Area type="monotone" dataKey="Domestic" stackId="1" fill={ROUTE_COLORS.domestic} stroke={ROUTE_COLORS.domestic} fillOpacity={0.5} />
              <Area type="monotone" dataKey="International" stackId="1" fill={ROUTE_COLORS.bilateral} stroke={ROUTE_COLORS.bilateral} fillOpacity={0.5} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title="Split" subtitle={`${selectedYear}`}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90}
                paddingAngle={3} dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                fontSize={11}>
                <Cell fill={ROUTE_COLORS.domestic} />
                <Cell fill={ROUTE_COLORS.bilateral} />
              </Pie>
              <Tooltip formatter={(v: any) => formatEmissions(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Transport Mode Emission Factors */}
      {factors.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartContainer title="Emission Intensity by Transport Mode"
            subtitle="Average kg CO₂ per tonne transported">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={factors}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="mode" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v: any) => [`${Number(v).toFixed(1)} kgCO₂/t`, 'TTW']} />
                <Bar dataKey="ttw" radius={[4, 4, 0, 0]}>
                  {factors.map((f, i) => (
                    <Cell key={i} fill={MODE_COLORS[f.modeKey] ?? '#4A9EFF'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title="Average Transport Distance by Mode"
            subtitle="Kilometres per route">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={factors}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="mode" stroke="#64748B" fontSize={12} />
                <YAxis stroke="#64748B" fontSize={12} tickFormatter={(v: any) => formatDistance(v)} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v: any) => [formatDistance(v), 'Avg Distance']} />
                <Bar dataKey="distance" radius={[4, 4, 0, 0]}>
                  {factors.map((f, i) => (
                    <Cell key={i} fill={MODE_COLORS[f.modeKey] ?? '#CCBB44'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}

      {/* Insight callout */}
      {factors.length >= 2 && (
        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-800/40 rounded-xl p-5">
          <p className="text-sm text-slate-300">
            <span className="font-semibold text-blue-400">Insight:</span>{' '}
            {factors[0].mode} transport of {commodity} emits{' '}
            <span className="font-bold text-white">
              {(factors[0].ttw / (factors[factors.length - 1].ttw || 1)).toFixed(1)}x
            </span>{' '}
            more CO₂ per tonne than {factors[factors.length - 1].mode} transport
            ({factors[0].ttw.toFixed(0)} vs {factors[factors.length - 1].ttw.toFixed(0)} kgCO₂/t).
          </p>
        </div>
      )}
    </div>
  )
}
