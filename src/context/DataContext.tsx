import { createContext, useContext, useState, type ReactNode } from 'react'
import type { CountryMetadata, DropdownLists } from '../types/data'
import { useDataLoader } from '../hooks/useDataLoader'

interface DataContextType {
  selectedYear: number
  setSelectedYear: (y: number) => void
  countryMeta: CountryMetadata | null
  dropdownLists: DropdownLists | null
  getCountryName: (iso3: string) => string
}

const DataContext = createContext<DataContextType | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [selectedYear, setSelectedYear] = useState(2023)
  const { data: countryMeta } = useDataLoader<CountryMetadata>('country_metadata.json')
  const { data: dropdownLists } = useDataLoader<DropdownLists>('dropdown_lists.json')

  const getCountryName = (iso3: string) => countryMeta?.[iso3]?.name ?? iso3

  return (
    <DataContext.Provider value={{ selectedYear, setSelectedYear, countryMeta, dropdownLists, getCountryName }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
