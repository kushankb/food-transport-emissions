import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, ReferenceLine,
} from 'recharts'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { useData } from '../context/DataContext'
import { useDataLoader } from '../hooks/useDataLoader'
import type { GlobalTimeseries, ConsumerCountries, Commodities } from '../types/data'
import { StatCard } from '../components/shared/StatCard'
import { YearSlider } from '../components/shared/YearSlider'
import { ChartContainer } from '../components/shared/ChartContainer'
import { LoadingSpinner } from '../components/shared/LoadingSpinner'
import { formatEmissionsMt, formatBillionTkm, formatVolume, formatPercent, formatEmissions } from '../utils/formatters'
import { ROUTE_COLORS, getSequentialColor } from '../utils/colors'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

export function GlobalOverview() {
  const { selectedYear, getCountryName, countryMeta } = useData()
  const { data: global, loading: gl } = useDataLoader<GlobalTimeseries>('global_timeseries.json')
  const { data: consumers, loading: cl } = useDataLoader<ConsumerCountries>('consumer_countries.json')
  const { data: commodities, loading: cml } = useDataLoader<Commodities>('commodities.json')
  const navigate = useNavigate()

  const yearIdx = global ? global.years.indexOf(selectedYear) : -1

  // Stat card values
  const ttwMt = yearIdx >= 0 ? global!.ttw_emissions_mtco2[yearIdx] : 0
  const foodMilesBt = yearIdx >= 0 ? global!.food_miles_billion_tkm[yearIdx] : 0
  const tradeVol = yearIdx >= 0 ? global!.trade_volume_mt[yearIdx] : 0

  // Compute international share from consumer data
  const intlShare = useMemo(() => {
    if (!consumers) return 0
    let bilateral = 0, total = 0
    for (const iso3 of Object.keys(consumers)) {
      const yd = consumers[iso3]?.[String(selectedYear)]
      if (yd?.bilateral) { bilateral += yd.bilateral.ttw; total += yd.bilateral.ttw }
      if (yd?.domestic) total += yd.domestic.ttw
    }
    return total > 0 ? (bilateral / total) * 100 : 0
  }, [consumers, selectedYear])

  // Time series chart data
  const timeSeriesData = useMemo(() => {
    if (!global) return []
    return global.years.map((y, i) => ({
      year: y,
      TTW: global.ttw_emissions_mtco2[i],
      WTT: global.wtt_emissions_mtco2[i],
      foodMiles: global.food_miles_billion_tkm[i],
    }))
  }, [global])

  // Domestic vs International stacked bar data
  const domesticVsIntl = useMemo(() => {
    if (!consumers) return []
    const years = Array.from({ length: 14 }, (_, i) => 2010 + i)
    return years.map(y => {
      let dom = 0, bil = 0
      for (const iso3 of Object.keys(consumers)) {
        const yd = consumers[iso3]?.[String(y)]
        if (yd?.domestic) dom += yd.domestic.ttw
        if (yd?.bilateral) bil += yd.bilateral.ttw
      }
      return { year: y, Domestic: Math.round(dom / 1e6 * 10) / 10, International: Math.round(bil / 1e6 * 10) / 10 }
    })
  }, [consumers])

  // Top 10 commodities for selected year
  const topCommodities = useMemo(() => {
    if (!commodities) return []
    return Object.entries(commodities)
      .map(([name, data]) => {
        const yd = data[String(selectedYear)]
        const ttw = (yd?.bilateral?.ttw ?? 0) + (yd?.domestic?.ttw ?? 0)
        return { name: name.length > 25 ? name.slice(0, 22) + '...' : name, ttw, fullName: name }
      })
      .sort((a, b) => b.ttw - a.ttw)
      .slice(0, 10)
  }, [commodities, selectedYear])

  // Top 15 consumer countries for selected year
  const topConsumers = useMemo(() => {
    if (!consumers) return []
    return Object.entries(consumers)
      .map(([iso3, data]) => {
        const yd = data[String(selectedYear)]
        const ttw = (yd?.bilateral?.ttw ?? 0) + (yd?.domestic?.ttw ?? 0)
        return { iso3, name: getCountryName(iso3), ttw }
      })
      .sort((a, b) => b.ttw - a.ttw)
      .slice(0, 15)
  }, [consumers, selectedYear, getCountryName])

  // Choropleth data
  const countryEmissions = useMemo(() => {
    if (!consumers) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const [iso3, data] of Object.entries(consumers)) {
      const yd = data[String(selectedYear)]
      const ttw = (yd?.bilateral?.ttw ?? 0) + (yd?.domestic?.ttw ?? 0)
      if (ttw > 0) map.set(iso3, ttw)
    }
    return map
  }, [consumers, selectedYear])

  const emissionValues = useMemo(() => Array.from(countryEmissions.values()), [countryEmissions])
  const minE = Math.min(...emissionValues, 0)
  const maxE = Math.max(...emissionValues, 1)

  // ISO numeric to ISO3 mapping for the map
  const isoNumToAlpha3 = useMemo(() => {
    if (!countryMeta) return new Map<string, string>()
    const isoMap: Record<string, string> = {
      '004':'AFG','008':'ALB','012':'DZA','024':'AGO','028':'ATG','032':'ARG','051':'ARM',
      '036':'AUS','040':'AUT','031':'AZE','044':'BHS','048':'BHR','050':'BGD','052':'BRB',
      '112':'BLR','056':'BEL','084':'BLZ','204':'BEN','064':'BTN','068':'BOL','070':'BIH',
      '072':'BWA','076':'BRA','096':'BRN','100':'BGR','854':'BFA','108':'BDI','132':'CPV',
      '116':'KHM','120':'CMR','124':'CAN','140':'CAF','148':'TCD','152':'CHL','156':'CHN',
      '170':'COL','174':'COM','178':'COG','180':'COD','188':'CRI','384':'CIV','191':'HRV',
      '192':'CUB','196':'CYP','203':'CZE','208':'DNK','262':'DJI','212':'DMA','214':'DOM',
      '218':'ECU','818':'EGY','222':'SLV','226':'GNQ','232':'ERI','233':'EST','748':'SWZ',
      '231':'ETH','242':'FJI','246':'FIN','250':'FRA','266':'GAB','270':'GMB','268':'GEO',
      '276':'DEU','288':'GHA','300':'GRC','308':'GRD','320':'GTM','324':'GIN','624':'GNB',
      '328':'GUY','332':'HTI','340':'HND','348':'HUN','352':'ISL','356':'IND','360':'IDN',
      '364':'IRN','368':'IRQ','372':'IRL','376':'ISR','380':'ITA','388':'JAM','392':'JPN',
      '400':'JOR','398':'KAZ','404':'KEN','408':'PRK','410':'KOR','414':'KWT','417':'KGZ',
      '418':'LAO','428':'LVA','422':'LBN','426':'LSO','430':'LBR','434':'LBY','440':'LTU',
      '442':'LUX','450':'MDG','454':'MWI','458':'MYS','462':'MDV','466':'MLI','470':'MLT',
      '478':'MRT','480':'MUS','484':'MEX','498':'MDA','496':'MNG','499':'MNE','504':'MAR',
      '508':'MOZ','104':'MMR','516':'NAM','524':'NPL','528':'NLD','554':'NZL','558':'NIC',
      '562':'NER','566':'NGA','807':'MKD','578':'NOR','512':'OMN','586':'PAK','591':'PAN',
      '598':'PNG','600':'PRY','604':'PER','608':'PHL','616':'POL','620':'PRT','634':'QAT',
      '642':'ROU','643':'RUS','646':'RWA','659':'KNA','662':'LCA','670':'VCT','882':'WSM',
      '678':'STP','682':'SAU','686':'SEN','688':'SRB','690':'SYC','694':'SLE','702':'SGP',
      '703':'SVK','705':'SVN','090':'SLB','706':'SOM','710':'ZAF','728':'SSD','724':'ESP',
      '144':'LKA','736':'SDN','740':'SUR','752':'SWE','756':'CHE','760':'SYR','762':'TJK',
      '834':'TZA','764':'THA','626':'TLS','768':'TGO','776':'TON','780':'TTO','788':'TUN',
      '792':'TUR','795':'TKM','800':'UGA','804':'UKR','784':'ARE','826':'GBR','840':'USA',
      '858':'URY','860':'UZB','548':'VUT','862':'VEN','704':'VNM','887':'YEM','894':'ZMB',
      '716':'ZWE','158':'TWN',
    }
    return new Map(Object.entries(isoMap))
  }, [countryMeta])

  if (gl || cl || cml) return <LoadingSpinner />

  const growthPct = global ? (
    ((global.ttw_emissions_mtco2[global.years.indexOf(2023)] - global.ttw_emissions_mtco2[0]) /
    global.ttw_emissions_mtco2[0]) * 100
  ).toFixed(0) : '0'

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="text-center py-6">
        <p className="text-sm text-slate-400 uppercase tracking-widest mb-2">The Carbon Cost of Moving Food</p>
        <h2 className="text-5xl sm:text-6xl font-extrabold text-blue-400">
          {formatEmissionsMt(ttwMt)} <span className="text-2xl sm:text-3xl text-slate-300 font-light">Mt CO₂</span>
        </h2>
        <p className="text-slate-500 mt-2">
          Transport emissions from global food trade in {selectedYear}
        </p>
      </div>

      {/* Year Slider */}
      <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
        <YearSlider />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Emissions" value={formatEmissionsMt(ttwMt)} unit="Mt CO₂" subtitle="Tank-to-wheel (direct)" />
        <StatCard label="Food Miles" value={formatBillionTkm(foodMilesBt)} unit="Bt-km" color="#66CCEE"
          subtitle="Tonne-kilometres" />
        <StatCard label="Trade Volume" value={formatVolume(tradeVol)} unit="Mt" color="#228833"
          subtitle="Total food traded" />
        <StatCard label="International Share" value={formatPercent(intlShare)} unit="" color="#EE6677"
          subtitle="Of total transport emissions" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="Global Transport Emissions Over Time"
          subtitle={`Emissions grew ${growthPct}% from 2010 to 2023`}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" stroke="#64748B" fontSize={12} />
              <YAxis stroke="#64748B" fontSize={12} label={{ value: 'Mt CO₂', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#F1F5F9' }} itemStyle={{ color: '#94A3B8' }} />
              <ReferenceLine x={selectedYear} stroke="#4A9EFF" strokeDasharray="4 4" strokeWidth={2} />
              <Area type="monotone" dataKey="TTW" stackId="1" fill="#4477AA" stroke="#4477AA" fillOpacity={0.6} name="Tank-to-Wheel" />
              <Area type="monotone" dataKey="WTT" stackId="1" fill="#AA3377" stroke="#AA3377" fillOpacity={0.6} name="Well-to-Tank" />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title="Domestic vs International Emissions"
          subtitle="Split by route type across all countries">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={domesticVsIntl}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="year" stroke="#64748B" fontSize={12} />
              <YAxis stroke="#64748B" fontSize={12} label={{ value: 'Mt CO₂', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#F1F5F9' }} itemStyle={{ color: '#94A3B8' }} />
              <ReferenceLine x={selectedYear} stroke="#4A9EFF" strokeDasharray="4 4" strokeWidth={2} />
              <Bar dataKey="Domestic" stackId="a" fill={ROUTE_COLORS.domestic} radius={[0, 0, 0, 0]} />
              <Bar dataKey="International" stackId="a" fill={ROUTE_COLORS.bilateral} radius={[2, 2, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94A3B8' }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartContainer title="Top 10 Commodities by Emissions"
          subtitle={`Transport emissions in ${selectedYear}`}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={topCommodities} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#64748B" fontSize={11}
                tickFormatter={(v: any) => formatEmissions(v)} />
              <YAxis type="category" dataKey="name" width={140} stroke="#64748B" fontSize={11} tick={{ fill: '#94A3B8' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#F1F5F9' }} formatter={(v: any) => [formatEmissions(v), 'TTW Emissions']} />
              <Bar dataKey="ttw" fill="#4A9EFF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>

        <ChartContainer title="Top 15 Consumer Countries"
          subtitle={`Click a country to explore details`}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={topConsumers} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" stroke="#64748B" fontSize={11}
                tickFormatter={(v: any) => formatEmissions(v)} />
              <YAxis type="category" dataKey="name" width={120} stroke="#64748B" fontSize={11}
                tick={{ fill: '#94A3B8', cursor: 'pointer' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#F1F5F9' }} formatter={(v: any) => [formatEmissions(v), 'TTW Emissions']} />
              <Bar dataKey="ttw" fill="#66CCEE" radius={[0, 4, 4, 0]}
                cursor="pointer"
                onClick={(d: any) => { if (d?.iso3) navigate(`/country/${d.iso3}`) }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>

      {/* World Map */}
      <ChartContainer title="Global Emissions by Consumer Country"
        subtitle={`Transport emissions (TTW) in ${selectedYear} — darker = higher emissions`}>
        <div className="h-[400px]">
          <ComposableMap
            projection="geoNaturalEarth1"
            projectionConfig={{ scale: 160 }}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup>
              <Geographies geography={GEO_URL}>
                {({ geographies }) =>
                  geographies.map(geo => {
                    const numericId = geo.id
                    const iso3 = isoNumToAlpha3.get(numericId) ?? ''
                    const val = countryEmissions.get(iso3) ?? 0
                    const fill = val > 0 ? getSequentialColor(Math.log(val + 1), Math.log(minE + 1), Math.log(maxE + 1)) : '#1E293B'
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke="#334155"
                        strokeWidth={0.4}
                        style={{
                          default: { outline: 'none' },
                          hover: { fill: '#4A9EFF', outline: 'none', cursor: 'pointer' },
                          pressed: { outline: 'none' },
                        }}
                        onClick={() => { if (iso3) navigate(`/country/${iso3}`) }}
                      />
                    )
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>
        </div>
      </ChartContainer>
    </div>
  )
}
