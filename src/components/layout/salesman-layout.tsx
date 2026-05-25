import type { ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Briefcase, LogOut } from 'lucide-react'
import { useRoleStore } from '../../stores/role-store'
import { useSalespersonStore } from '../../stores/salesperson-store'
import { useSmartBack } from '../../lib/use-smart-back'
import { TopToolbar } from '../Toolbar/top-toolbar'

const TABS: { to: string; label: string; end: boolean }[] = []

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function SalesmanLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const smartBack = useSmartBack()
  const { pathname } = useLocation()
  const isEditor = pathname.endsWith('/editor')
  const salespeople = useSalespersonStore((s) => s.salespeople)
  const activeSalespersonId = useRoleStore((s) => s.activeSalespersonId)
  const setActiveSalespersonId = useRoleStore((s) => s.setActiveSalespersonId)
  const activeSalesperson = activeSalespersonId
    ? salespeople.find((sp) => sp.id === activeSalespersonId) ?? null
    : null

  if (isEditor) {
    // Fallback to the pallet detail URL when there's no in-app history
    // (e.g. someone opened the editor via a deep link).
    const palletPath = pathname.replace(/\/editor\/?$/, '')
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <button
          onClick={() => smartBack(palletPath)}
          className="fixed top-4 left-4 z-[60] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/95 backdrop-blur text-[12px] font-medium text-[#555] hover:text-[#171717] shadow-card transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back
        </button>
        <TopToolbar />
        <main className="pt-16">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-[#171717] flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-[#ececec]">
        <div className="max-w-[1280px] mx-auto px-8 h-[60px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-[15px] font-semibold tracking-display text-[#171717]">
                PalletForge
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#888] px-2 py-0.5 rounded-full bg-[#f3f3f3] flex items-center gap-1">
                <Briefcase className="w-3 h-3" />
                Salesman
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
                      : 'text-[#555] hover:text-[#171717] hover:bg-[#f3f3f3]'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {salespeople.length > 0 && (
              <div className="relative">
                {activeSalesperson ? (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-[#f3f3f3] hover:bg-[#eaeaea] transition-colors">
                    <span className="w-7 h-7 rounded-full bg-[#171717] text-white text-[11px] font-semibold flex items-center justify-center">
                      {initialsOf(activeSalesperson.name)}
                    </span>
                    <select
                      value={activeSalespersonId ?? ''}
                      onChange={(e) => setActiveSalespersonId(e.target.value || null)}
                      className="bg-transparent text-[12px] font-medium text-[#171717] outline-none cursor-pointer pr-4 appearance-none"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='%23999'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 0 center',
                        backgroundSize: '0.9rem',
                      }}
                    >
                      {salespeople.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    value=""
                    onChange={(e) => setActiveSalespersonId(e.target.value || null)}
                    className="bg-[#171717] text-white text-[12px] font-medium rounded-md px-3 py-2 cursor-pointer appearance-none pr-7"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='%23eee'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' /%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundSize: '0.9rem',
                    }}
                  >
                    <option value="">Pick your name…</option>
                    {salespeople.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <button
              onClick={() => navigate('/')}
              className="text-[12px] text-[#888] hover:text-[#171717] flex items-center gap-1.5 px-2 py-1 transition-colors"
              title="Switch role"
            >
              <LogOut className="w-3.5 h-3.5" />
              Switch
            </button>
          </div>
        </div>

        <nav className="md:hidden border-t border-[#ececec] flex items-center gap-1 px-4 py-2 overflow-x-auto">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-[12px] font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-[#171717] text-white'
                    : 'text-[#555] hover:text-[#171717] hover:bg-[#f3f3f3]'
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
