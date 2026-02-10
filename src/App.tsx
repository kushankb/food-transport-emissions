import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { DataProvider } from './context/DataContext'
import { Header } from './components/layout/Header'
import { GlobalOverview } from './views/GlobalOverview'
import { CountryExplorer } from './views/CountryExplorer'
import { CommodityExplorer } from './views/CommodityExplorer'
import { BilateralFlowMap } from './views/BilateralFlowMap'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <DataProvider>
        <div className="min-h-screen bg-slate-950">
          <Header />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <Routes>
              <Route path="/" element={<GlobalOverview />} />
              <Route path="/country" element={<CountryExplorer />} />
              <Route path="/country/:iso3" element={<CountryExplorer />} />
              <Route path="/commodity" element={<CommodityExplorer />} />
              <Route path="/commodity/:name" element={<CommodityExplorer />} />
              <Route path="/flows" element={<BilateralFlowMap />} />
            </Routes>
          </main>
          <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
            Global Food Transport Emissions Analysis &middot; Data: 2010–2024 &middot;
            Consumption-based transport emissions for 197 countries and 204 commodities
          </footer>
        </div>
      </DataProvider>
    </BrowserRouter>
  )
}
