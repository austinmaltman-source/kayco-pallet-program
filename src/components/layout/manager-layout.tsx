import type { ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Boxes,
  Briefcase,
  Building2,
  CalendarRange,
  Compass,
  Eye,
  HardHat,
  HelpCircle,
  Home,
  LogOut,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
} from 'lucide-react'
import { TopToolbar } from '../Toolbar/top-toolbar'
import { SyncStatusChip } from '../SyncStatus/sync-status-chip'

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

const TODAY: NavItem[] = [{ to: '/manager', label: 'Dashboard', icon: Home, end: true }]

const OPERATIONS: NavItem[] = [
  { to: '/manager/pallets', label: 'All Pallets', icon: Boxes },
  { to: '/manager/builders', label: 'Build Queue', icon: HardHat },
  { to: '/manager/demand', label: 'Demand', icon: TrendingUp },
  { to: '/manager/transfers', label: 'Transfers', icon: ArrowLeftRight },
]

const SETUP: NavItem[] = [
  { to: '/manager/retailers', label: 'Programs', icon: Building2 },
  { to: '/manager/seasons', label: 'Seasons', icon: CalendarRange },
  { to: '/manager/catalog', label: 'Catalog', icon: Package },
  { to: '/manager/assignments', label: 'Assignments', icon: Users },
]

const VIEW_AS: { to: string; label: string; icon: typeof Briefcase }[] = [
  { to: '/manager/views/salesman', label: 'Salesman', icon: Briefcase },
  { to: '/manager/views/builder', label: 'Builder', icon: HardHat },
  { to: '/manager/views/buyer', label: 'Buyer', icon: ShoppingCart },
]

function NavSection({ heading, items }: { heading: string; items: NavItem[] }) {
  return (
    <div className="mb-5">
      <p className="px-3 mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#666]">
        {heading}
      </p>
      <div className="space-y-0.5 px-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 ${
                isActive
                  ? 'text-white bg-white/[0.08]'
                  : 'text-[#888] hover:text-[#ccc] hover:bg-white/[0.04]'
              }`
            }
          >
            <Icon size={15} />
            <span className="text-[12.5px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export function ManagerLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isEditor = pathname.endsWith('/editor')

  return (
    <div className="flex min-h-screen bg-[#fafafa] text-[#171717]">
      <aside className="w-[240px] h-screen fixed left-0 top-0 bg-[#0e0e0e] flex flex-col py-5 px-3 z-50">
        <Link to="/" className="mb-6 px-3 block">
          <h1 className="text-[15px] font-semibold text-white tracking-display">PalletForge</h1>
          <p className="text-[10px] text-[#666] mt-1 flex items-center gap-1">
            <Compass className="w-3 h-3 text-[#888]" />
            Manager workspace
          </p>
        </Link>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">
          <NavSection heading="Today" items={TODAY} />
          <NavSection heading="Operations" items={OPERATIONS} />
          <NavSection heading="Setup" items={SETUP} />

          <div className="mb-2">
            <p className="px-3 mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#666] flex items-center gap-1">
              <Eye className="w-3 h-3" />
              View as
            </p>
            <div className="space-y-0.5 px-1">
              {VIEW_AS.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 px-3 py-2 rounded-md text-[#888] hover:text-white hover:bg-white/[0.04] transition-colors duration-150"
                >
                  <Icon size={15} />
                  <span className="text-[12.5px] font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div
          className="pt-4 mt-3 px-1 space-y-0.5"
          style={{ boxShadow: '0 -1px 0 0 rgba(255,255,255,0.06)' }}
        >
          <SyncStatusChip />
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-[#666] hover:text-[#ccc] hover:bg-white/[0.04] transition-colors duration-150 w-full"
          >
            <LogOut size={13} />
            <span className="text-[11px] font-medium">Switch role</span>
          </button>
          <button className="flex items-center gap-3 px-3 py-2 rounded-md text-[#666] hover:text-[#999] hover:bg-white/[0.04] transition-colors duration-150 w-full">
            <HelpCircle size={13} />
            <span className="text-[11px] font-medium">Support</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-[240px] relative min-h-screen flex flex-col">
        {isEditor && <TopToolbar />}
        <div className={`flex-1 ${isEditor ? 'pt-16' : ''}`}>{children}</div>
      </main>
    </div>
  )
}
