export function formatEmissions(tco2: number): string {
  if (tco2 >= 1_000_000) return `${(tco2 / 1_000_000).toFixed(1)} Mt`
  if (tco2 >= 1_000) return `${(tco2 / 1_000).toFixed(1)}k t`
  return `${tco2.toFixed(0)} t`
}

export function formatEmissionsMt(mtco2: number): string {
  return `${mtco2.toFixed(1)}`
}

export function formatFoodMiles(tkm: number): string {
  if (tkm >= 1e12) return `${(tkm / 1e12).toFixed(1)} Tt-km`
  if (tkm >= 1e9) return `${(tkm / 1e9).toFixed(1)} Bt-km`
  if (tkm >= 1e6) return `${(tkm / 1e6).toFixed(1)} Mt-km`
  if (tkm >= 1e3) return `${(tkm / 1e3).toFixed(0)}k t-km`
  return `${tkm.toFixed(0)} t-km`
}

export function formatBillionTkm(btkm: number): string {
  return btkm.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function formatVolume(mt: number): string {
  return mt.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`
  return n.toFixed(0)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatCost(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(1)}B`
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}k`
  return `$${usd.toFixed(0)}`
}

export function formatDistance(km: number): string {
  if (km >= 1000) return `${(km / 1000).toFixed(0)}k km`
  return `${km.toFixed(0)} km`
}
