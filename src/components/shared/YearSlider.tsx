import { useData } from '../../context/DataContext'

export function YearSlider({ min = 2010, max = 2023 }: { min?: number; max?: number }) {
  const { selectedYear, setSelectedYear } = useData()

  return (
    <div className="flex items-center gap-4">
      <label className="text-sm font-medium text-slate-400 whitespace-nowrap">Year</label>
      <input
        type="range" min={min} max={max} value={selectedYear}
        onChange={e => setSelectedYear(Number(e.target.value))}
        className="flex-1 max-w-xs"
        aria-label={`Select year, currently ${selectedYear}`}
      />
      <span className="text-2xl font-bold text-blue-400 tabular-nums min-w-[4ch]">{selectedYear}</span>
    </div>
  )
}
