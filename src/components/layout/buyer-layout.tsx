import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, ShoppingCart } from 'lucide-react'
import { SyncStatusChip } from '../SyncStatus/sync-status-chip'

const TABS = [
  { to: '/buyer', label: 'Demand', end: true },
  { to: '/buyer/pallets', label: 'Pallets', end: false },
  { to: '/buyer/catalog', label: 'Catalog', end: false },
  { to: '/buyer/retailers', label: 'Retailers', end: false },
  { to: '/buyer/builders', label: 'Build queue', end: false },
]

export function BuyerLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#f5f7fa] text-[#171717] flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-[#e5ebf2]">
        <div className="max-w-[1320px] mx-auto px-8 h-[60px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-display text-[#171717]">
                Kayco Pallet Programs
              </span>
              <span className="text-[10px] uppercase tracking-wider text-teal-700 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center gap-1">
                <ShoppingCart className="w-3 h-3" />
                Buyer
              </span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {TABS.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-md text-[13px] font-medium transition-colors ${
                    isActive
                      ? 'bg-[#171717] text-white'
                      : 'text-[#555] hover:text-[#171717] hover:bg-[#eef2f7]'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <SyncStatusChip variant="bar" />
          <button
            onClick={() => navigate('/')}
            className="text-[12px] text-[#888] hover:text-[#171717] flex items-center gap-1.5 px-2 py-1 transition-colors"
            title="Switch role"
          >
            <LogOut className="w-3.5 h-3.5" />
            Switch
          </button>
        </div>

        <nav className="md:hidden border-t border-[#e5ebf2] flex items-center gap-1 px-4 py-2 overflow-x-auto">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#171717] text-white'
                    : 'text-[#555] hover:text-[#171717] hover:bg-[#eef2f7]'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  )
}
