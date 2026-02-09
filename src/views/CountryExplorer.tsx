import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts'
import { useData } from '../context/DataContext'
import { useDataLoader } from '../hooks/useDataLoader'
import type { ConsumerCountries, ProducerCountries, BilateralTopFlows } from '../types/data'
import { StatCard } from '../components/shared/StatCard'
import { YearSlider } from '../components/shared/YearSlider'
import { ChartContainer } from '../components/shared/ChartContainer'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { formatEmissions, formatFoodMiles } from '../utils/formatters'
import { ROUTE_COLORS } from '../utils/colors'

export function CountryExplorer() {
  const { iso3: paramIso3 } = useParams()
  const navigate = useNavigate()
  const { selectedYear, getCountryName, dropdownLists } = useData()
  const { data: consumers, loading: cl } = useDataLoader<ConsumerCountries>('consumer_countries.json')
  const { data: producers } = useDataLoader<ProducerCountries>('producer_countries.json')
  const { data: bilateral } = useDataLoader<BilateralTopFlows>('bilateral_top_flows.json')

  const [search, setSearch] = useState('')
  const iso3 = paramIso3 || 'USA'

  const filtered = useMemo(() => {
    if (!dropdownLists) return []
    const q = search.toLowerCase()
    return dropdownLists.countries.filter(c =>
      c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)
    ).slice(0, 20)
  }, [dropdownLists, search])

  const yearStr = String(selectedYear)
  const countryData = consumers?.[iso3]
  const producerData = producers?.[iso3]
  const yd = countryData?.[yearStr]
  const bilTtw = yd?.bilateral?.ttw ?? 0
  const domTtw = yd?.domestic?.ttw ?? 0
  const totalTtw = bilTtw + domTtw
  const totalFm = (yd?.bilateral?.food_miles ?? 0) + (yd?.domestic?.food_miles ?? 0)

  // Time series
  const timeSeries = useMemo(() => {
    if (!countryData) return []
    return Array.from({ length: 14 }, (_, i) => {
      const y = 2010 + i
      const d = countryData[String(y)]
      return {
        year: y,
        Domestic: d?.domestic?.ttw ? Math.round(d.domestic.ttw / 1e3) : 0,
        International: d?.bilateral?.ttw ? Math.round(d.bilateral.ttw / 1e3) : 0,
      }
    })
  }, [countryData])

  // Pie data
  const pieData = [
    { name: 'Domestic', value: domTtw },
    { name: 'International', value: bilTtw },
  ]

  // Top source countries (imports TO this country)
  const topSources = useMemo(() => {
    if (!bilateral) return []
    const flows = bilateral[yearStr]?.all ?? []
    return flows
      .filter((f: any) => f.to === iso3)
      .sort((a: any, b: any) => b.ttw - a.ttw)
      .slice(0, 10)
      .map((f: any) => ({ name: getCountryName(f.from), ttw: f.ttw, iso3: f.from }))
  }, [bilateral, yearStr, iso3, getCountryName])

  // Top destinations (exports FROM this country)
  const topDest = useMemo(() => {
    if (!bilateral) return []
    const flows = bilateral[yearStr]?.all ?? []
    return flows
      .filter((f: any) => f.from === iso3)
      .sort((a: any, b: any) => b.ttw - a.ttw)
      .slice(0, 10)
      .map((f: any) => ({ name: getCountryName(f.to), ttw: f.ttw, iso3: f.to }))
  }, [bilateral, yearStr, iso3, getCountryName])

  // Producer time series
  const producerTimeSeries = useMemo(() => {
    if (!producerData) return []
    return Array.from({ length: 14 }, (_, i) => {
      const y = 2010 + i
      const d = producerData[String(y)]
      return {
        year: y,
        Domestic: d?.domestic?.ttw ? Math.round(d.domestic.ttw / 1e3) : 0,
        Exports: d?.bilateral?.ttw ? Math.round(d.bilateral.ttw / 1e3) : 0,
      }
    })
  }, [producerData])

  if (cl) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      {/* Country selector */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && filtered.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                {filtered.map(c => (
                  <button key={c.iso3}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-slate-700 text-slate-200"
                    onClick={() => { navigate(`/country/${c.iso3}`); setSearch('') }}>
                    {c.name} <span className="text-slate-500">({c.iso3})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <YearSlider />
        </div>
      </div>

      {/* Country header */}
      <div>
        <h2 className="text-3xl font-bold text-slate-100">{getCountryName(iso3)}</h2>
        <p className="text-sm text-slate-400 mt-1">Consumption-based food transport emissions</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Emissions" value={formatEmissions(totalTtw)} unit="CO₂" />
        <StatCard label="Domestic" value={formatEmissions(domTtw)} unit="CO₂" color={ROUTE_COLORS.domestic} />
        <StatCard label="International" value={formatEmissions(bilTtw)} unit="CO₂" color={ROUTE_COLORS.bilateral} />
        <StatCard label="Food Miles" value={formatFoodMiles(totalFm)} unit="" color="#66CCEE" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartContainer title="Consumption Emissions Over Time" subtitle="Thousand tonnes CO₂" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" stroke="#64748B" fontSize={12} />
              <YAxis stroke="#64748B" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#F1F5F9' }} />
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
                paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: '#64748B' }} fontSize={11}>
                <Cell fill={ROUTE_COLORS.domestic} />
                <Cell fill={ROUTE_COLORS.bilateral} />
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                formatter={(v: any) => formatEmissions(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Trade Partners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="Top Import Sources" subtitle={`Who ${getCountryName(iso3)} imports from — by transport emissions`}>
          {topSources.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSources} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} tickFormatter={(v: any) => formatEmissions(v)} />
                <YAxis type="category" dataKey="name" width={110} stroke="#64748B" fontSize={11} tick={{ fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v: any) => [formatEmissions(v), 'TTW']} />
                <Bar dataKey="ttw" fill="#4A9EFF" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(d: any) => { if (d?.iso3) navigate(`/country/${d.iso3}`) }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-500 text-sm py-10 text-center">No bilateral data available for this year</p>}
        </ChartContainer>

        <ChartContainer title="Top Export Destinations" subtitle={`Where ${getCountryName(iso3)} exports to`}>
          {topDest.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topDest} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" stroke="#64748B" fontSize={11} tickFormatter={(v: any) => formatEmissions(v)} />
                <YAxis type="category" dataKey="name" width={110} stroke="#64748B" fontSize={11} tick={{ fill: '#94A3B8' }} />
                <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                  formatter={(v: any) => [formatEmissions(v), 'TTW']} />
                <Bar dataKey="ttw" fill="#66CCEE" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(d: any) => { if (d?.iso3) navigate(`/country/${d.iso3}`) }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-slate-500 text-sm py-10 text-center">No bilateral data available for this year</p>}
        </ChartContainer>
      </div>

      {/* Producer perspective */}
      <ChartContainer title={`${getCountryName(iso3)} as Producer`}
        subtitle="Emissions from food exported and domestically consumed — thousand tonnes CO₂">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={producerTimeSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="year" stroke="#64748B" fontSize={12} />
            <YAxis stroke="#64748B" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
              labelStyle={{ color: '#F1F5F9' }} />
            <ReferenceLine x={selectedYear} stroke="#4A9EFF" strokeDasharray="4 4" strokeWidth={2} />
            <Area type="monotone" dataKey="Domestic" stackId="1" fill={ROUTE_COLORS.domestic} stroke={ROUTE_COLORS.domestic} fillOpacity={0.5} />
            <Area type="monotone" dataKey="Exports" stackId="1" fill="#228833" stroke="#228833" fillOpacity={0.5} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
