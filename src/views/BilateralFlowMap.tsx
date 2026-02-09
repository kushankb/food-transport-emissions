import { useMemo, useState } from 'react'
import {
  ComposableMap, Geographies, Geography, Line, ZoomableGroup,
} from 'react-simple-maps'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useData } from '../context/DataContext'
import { useDataLoader } from '../hooks/useDataLoader'
import type { BilateralTopFlows, BilateralByCommodity } from '../types/data'
import { YearSlider } from '../components/shared/YearSlider'
import { ChartContainer } from '../components/shared/ChartContainer'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { formatEmissions, formatFoodMiles, formatCost } from '../utils/formatters'
import { MODE_COLORS } from '../utils/colors'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

export function BilateralFlowMap() {
  const { selectedYear, getCountryName, countryMeta } = useData()
  const { data: bilateral, loading } = useDataLoader<BilateralTopFlows>('bilateral_top_flows.json')
  const { data: bilateralByCommodity, loading: commLoading } = useDataLoader<BilateralByCommodity>('bilateral_by_commodity.json')

  const [modeFilter, setModeFilter] = useState('all')
  const [minEmissions, setMinEmissions] = useState(0)
  const [hoveredFlow, setHoveredFlow] = useState<number | null>(null)
  const [selectedCommodity, setSelectedCommodity] = useState('')
  const [commoditySearch, setCommoditySearch] = useState('')
  const [showCommodityDropdown, setShowCommodityDropdown] = useState(false)

  const yearStr = String(selectedYear)

  // Get flows based on commodity selection + mode filter
  const allFlows = useMemo(() => {
    if (selectedCommodity && bilateralByCommodity) {
      // Commodity-specific flows
      return bilateralByCommodity[selectedCommodity]?.[yearStr] ?? []
    }
    // All commodities — use per-mode data
    if (!bilateral?.[yearStr]) return []
    return bilateral[yearStr][modeFilter] ?? []
  }, [bilateral, bilateralByCommodity, selectedCommodity, yearStr, modeFilter])

  const filteredFlows = useMemo(() => {
    let flows = allFlows
    // When a commodity is selected, we still need to filter by mode
    if (selectedCommodity) {
      flows = flows.filter(f => {
        if (modeFilter !== 'all' && f.dominant_mode !== modeFilter) return false
        return true
      })
    }
    // Apply min emissions filter
    return flows
      .filter(f => f.ttw >= minEmissions)
      .slice(0, 100)
  }, [allFlows, modeFilter, minEmissions, selectedCommodity])

  const maxTtw = useMemo(() => Math.max(...filteredFlows.map(f => f.ttw), 1), [filteredFlows])

  // Top 20 corridors for bar chart
  const topCorridors = useMemo(() => {
    return filteredFlows
      .slice(0, 20)
      .map(f => ({
        corridor: `${getCountryName(f.from).slice(0, 12)} → ${getCountryName(f.to).slice(0, 12)}`,
        ttw: f.ttw,
        mode: f.dominant_mode,
      }))
  }, [filteredFlows, getCountryName])

  const modes = ['all', 'land', 'maritime', 'air']

  // Commodity list for dropdown — derived from bilateral data (60 transport categories)
  const commodityList = useMemo(() => {
    if (!bilateralByCommodity) return []
    const list = Object.keys(bilateralByCommodity).sort()
    if (!commoditySearch) return list
    const q = commoditySearch.toLowerCase()
    return list.filter(c => c.toLowerCase().includes(q))
  }, [bilateralByCommodity, commoditySearch])

  const getCoords = (iso3: string): [number, number] | null => {
    const meta = countryMeta?.[iso3]
    if (!meta) return null
    return [meta.lng, meta.lat]
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center flex-wrap">
          <YearSlider />

          {/* Commodity dropdown */}
          <div className="relative">
            <div
              className="flex items-center gap-2 bg-slate-700 rounded-lg px-3 py-1.5 cursor-pointer min-w-[200px]"
              onClick={() => setShowCommodityDropdown(!showCommodityDropdown)}
            >
              <span className="text-xs font-medium text-slate-300 truncate">
                {selectedCommodity || 'All Commodities'}
              </span>
              <svg className="w-3 h-3 text-slate-400 ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showCommodityDropdown && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden">
                <div className="p-2 border-b border-slate-700">
                  <input
                    type="text"
                    placeholder="Search commodities..."
                    value={commoditySearch}
                    onChange={e => setCommoditySearch(e.target.value)}
                    className="w-full bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto max-h-60">
                  <button
                    onClick={() => { setSelectedCommodity(''); setShowCommodityDropdown(false); setCommoditySearch('') }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 ${
                      !selectedCommodity ? 'text-blue-400 font-medium' : 'text-slate-300'
                    }`}
                  >
                    All Commodities
                  </button>
                  {commodityList.map(c => (
                    <button
                      key={c}
                      onClick={() => { setSelectedCommodity(c); setShowCommodityDropdown(false); setCommoditySearch('') }}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-slate-700 truncate ${
                        selectedCommodity === c ? 'text-blue-400 font-medium' : 'text-slate-300'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {modes.map(m => (
              <button key={m}
                onClick={() => setModeFilter(m)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  modeFilter === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}>
                {m === 'all' ? 'All Modes' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <label>Min emissions:</label>
            <input type="range" min={0} max={Math.max(...allFlows.map(f => f.ttw), 100000)}
              value={minEmissions}
              onChange={e => setMinEmissions(Number(e.target.value))}
              className="w-32" />
            <span className="text-blue-400 text-xs">{formatEmissions(minEmissions)}</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <ChartContainer
        title={selectedCommodity ? `Trade Flows: ${selectedCommodity}` : 'Global Trade Flow Network'}
        subtitle={`${filteredFlows.length} corridors shown for ${selectedYear} — line width proportional to TTW emissions`}
        className="overflow-hidden">
        <div className="h-[500px] relative">
          <ComposableMap
            projection="geoNaturalEarth1"
            projectionConfig={{ scale: 160 }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => (
                    <Geography key={geo.rsmKey} geography={geo}
                      fill="#1E293B" stroke="#334155" strokeWidth={0.3}
                      style={{ default: { outline: 'none' }, hover: { outline: 'none' }, pressed: { outline: 'none' } }}
                    />
                  ))
                }
              </Geographies>

              {filteredFlows.map((flow, i) => {
                const from = getCoords(flow.from)
                const to = getCoords(flow.to)
                if (!from || !to) return null
                const width = Math.max(0.5, (flow.ttw / maxTtw) * 4)
                const opacity = hoveredFlow === i ? 1 : 0.4 + (flow.ttw / maxTtw) * 0.4
                const color = MODE_COLORS[flow.dominant_mode] ?? '#4A9EFF'
                return (
                  <Line key={i}
                    from={from} to={to}
                    stroke={color}
                    strokeWidth={width}
                    strokeLinecap="round"
                    strokeOpacity={opacity}
                    onMouseEnter={() => setHoveredFlow(i)}
                    onMouseLeave={() => setHoveredFlow(null)}
                    style={{ cursor: 'pointer' }}
                  />
                )
              })}
            </ZoomableGroup>
          </ComposableMap>

          {/* Tooltip */}
          {hoveredFlow !== null && filteredFlows[hoveredFlow] && (
            <div className="absolute top-4 right-4 bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl text-sm z-50">
              <p className="font-semibold text-slate-100">
                {getCountryName(filteredFlows[hoveredFlow].from)} → {getCountryName(filteredFlows[hoveredFlow].to)}
              </p>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                <p>Emissions: <span className="text-blue-400">{formatEmissions(filteredFlows[hoveredFlow].ttw)}</span> CO₂</p>
                <p>Food Miles: <span className="text-cyan-400">{formatFoodMiles(filteredFlows[hoveredFlow].food_miles)}</span></p>
                <p>Transport Cost: <span className="text-green-400">{formatCost(filteredFlows[hoveredFlow].cost)}</span></p>
                <p>Mode: <span className="capitalize">{filteredFlows[hoveredFlow].dominant_mode}</span></p>
                {!selectedCommodity && <p>Commodities: {filteredFlows[hoveredFlow].n_commodities}</p>}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-slate-800/90 border border-slate-600 rounded-lg p-3 text-xs space-y-1.5">
            {Object.entries(MODE_COLORS).filter(([k]) => ['maritime', 'air', 'land'].includes(k)).map(([mode, color]) => (
              <div key={mode} className="flex items-center gap-2">
                <div className="w-5 h-1 rounded" style={{ backgroundColor: color }} />
                <span className="text-slate-300 capitalize">{mode}</span>
              </div>
            ))}
          </div>
        </div>
      </ChartContainer>

      {/* Top corridors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="Top 20 Trade Corridors" subtitle={`By TTW emissions in ${selectedYear}`}>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={topCorridors} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#64748B" fontSize={11}
                tickFormatter={(v: any) => formatEmissions(v)} />
              <YAxis type="category" dataKey="corridor" width={160} stroke="#64748B" fontSize={10}
                tick={{ fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: any) => [formatEmissions(v), 'TTW']} />
              <Bar dataKey="ttw" radius={[0, 4, 4, 0]}>
                {topCorridors.map((c, i) => (
                  <Cell key={i} fill={MODE_COLORS[c.mode] ?? '#4A9EFF'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Data table */}
        <ChartContainer title="Flow Details" subtitle={`${filteredFlows.length} corridors`}>
          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="text-left py-2 px-2">From</th>
                  <th className="text-left py-2 px-2">To</th>
                  <th className="text-right py-2 px-2">Emissions</th>
                  <th className="text-right py-2 px-2">Mode</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlows.slice(0, 50).map((f, i) => (
                  <tr key={i} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="py-1.5 px-2 text-slate-300">{getCountryName(f.from)}</td>
                    <td className="py-1.5 px-2 text-slate-300">{getCountryName(f.to)}</td>
                    <td className="py-1.5 px-2 text-right text-blue-400">{formatEmissions(f.ttw)}</td>
                    <td className="py-1.5 px-2 text-right capitalize" style={{ color: MODE_COLORS[f.dominant_mode] ?? '#94A3B8' }}>
                      {f.dominant_mode}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartContainer>
      </div>

      {/* Loading indicator for commodity data */}
      {commLoading && selectedCommodity && (
        <div className="text-center text-slate-500 text-sm py-4">Loading commodity data...</div>
      )}
    </div>
  )
}
