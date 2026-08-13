import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { HardHat, LogOut } from 'lucide-react'
import { SyncStatusChip } from '../SyncStatus/sync-status-chip'

const TABS = [
  { to: '/builder', label: 'Queue', end: true },
  { to: '/builder/builders', label: 'Board', end: false },
  { to: '/builder/retailers', label: 'Pallets', end: false },
  { to: '/builder/catalog', label: 'Catalog', end: false },
]

export function BuilderLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0f0f10] text-white flex flex-col">
      <header className="sticky top-0 z-40 bg-[#0f0f10] border-b border-white/[0.08]">
        <div className="max-w-[1320px] mx-auto px-8 h-[64px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="text-[16px] font-semibold tracking-display text-white">
                Kayco Pallet Programs
              </span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <HardHat className="w-3 h-3" />
                Builder
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
                      ? 'bg-white text-[#111]'
                      : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <SyncStatusChip variant="bar" dark />
          <button
            onClick={() => navigate('/')}
            className="text-[12px] text-white/50 hover:text-white flex items-center gap-1.5 px-2 py-1 transition-colors"
            title="Switch role"
          >
            <LogOut className="w-3.5 h-3.5" />
            Switch
          </button>
        </div>

        <nav className="md:hidden border-t border-white/[0.08] flex items-center gap-1 px-4 py-2 overflow-x-auto">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-white text-[#111]'
                    : 'text-white/60 hover:text-white hover:bg-white/[0.06]'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 bg-[#0f0f10] text-[#171717]">
        <div className="bg-[#fafafa] min-h-[calc(100vh-64px)]">{children}</div>
      </main>
    </div>
  )
}
