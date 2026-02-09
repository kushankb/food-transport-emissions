export interface GlobalTimeseries {
  years: number[]
  trade_volume_mt: number[]
  wtw_emissions_mtco2: number[]
  ttw_emissions_mtco2: number[]
  wtt_emissions_mtco2: number[]
  food_miles_billion_tkm: number[]
  preliminary_years: number[]
}

export interface RouteEmissions {
  wtw: number
  ttw: number
  wtt: number
  food_miles: number
  value: number
  cost?: number
}

export interface CountryYearData {
  [year: string]: {
    bilateral?: RouteEmissions
    domestic?: RouteEmissions
  }
}

export interface ConsumerCountries { [iso3: string]: CountryYearData }
export interface ProducerCountries { [iso3: string]: CountryYearData }

export interface CommodityRouteData {
  wtw: number
  ttw: number
  food_miles: number
  value: number
}

export interface CommodityYearData {
  [year: string]: {
    bilateral?: CommodityRouteData
    domestic?: CommodityRouteData
  }
}

export interface Commodities { [commodity: string]: CommodityYearData }

export interface BilateralFlow {
  from: string
  to: string
  wtw: number
  ttw: number
  wtt: number
  food_miles: number
  cost: number
  n_commodities: number
  dominant_mode: string
}

export interface BilateralTopFlows {
  [year: string]: { [mode: string]: BilateralFlow[] }
}

export interface BilateralByCommodity {
  [commodity: string]: { [year: string]: BilateralFlow[] }
}

export interface GlobalByModeEntry {
  mode: string
  wtw: number
  ttw: number
  wtt: number
  food_miles: number
  value: number
}

export interface GlobalByMode { [year: string]: GlobalByModeEntry[] }

export interface TransportModeFactor {
  wtw: number
  ttw: number
  distance: number
  routes: number
}

export interface TransportFactors {
  [commodity: string]: { [mode: string]: TransportModeFactor }
}

export interface CountryMeta {
  name: string
  lat: number
  lng: number
  region: string
}

export interface CountryMetadata { [iso3: string]: CountryMeta }

export interface CountryListItem {
  iso3: string
  name: string
  region: string
}

export interface DropdownLists {
  commodities: string[]
  countries: CountryListItem[]
}
