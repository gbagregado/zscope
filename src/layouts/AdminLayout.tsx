import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { usePendingCounts, type PendingCounts } from '../lib/usePendingCounts'
import {
  LayoutDashboard,
  BarChart3,
  Users,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  Megaphone,
  Image,
  TrendingUp,
  Building2,
  Landmark,
  LogOut,
  Bell,
} from 'lucide-react'
import clsx from 'clsx'
import logo from '../assets/logo.jpeg'

type CountKey = keyof Omit<PendingCounts, 'total'>

const nav: { to: string; label: string; icon: typeof Users; end?: boolean; badge?: CountKey }[] = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/members', label: 'Members', icon: Users, badge: 'members' },
  { to: '/admin/payment-methods', label: 'Payment Methods', icon: CreditCard },
  { to: '/admin/payment-requests', label: 'Add Funds', icon: ArrowDownCircle, badge: 'payments' },
  { to: '/admin/withdrawal-requests', label: 'Withdrawals', icon: ArrowUpCircle, badge: 'withdrawals' },
  { to: '/admin/profits', label: 'Profits', icon: TrendingUp },
  { to: '/admin/investment-centers', label: 'Inv. Centers', icon: Building2 },
  { to: '/admin/investments', label: 'Investments', icon: Landmark, badge: 'investments' },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/advertisements', label: 'Advertisements', icon: Image },
]

const pageTitles: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/reports': 'Reports',
  '/admin/members': 'Members',
  '/admin/payment-methods': 'Payment Methods',
  '/admin/payment-requests': 'Add Funds Requests',
  '/admin/withdrawal-requests': 'Withdrawal Requests',
  '/admin/profits': 'Add Profit',
  '/admin/investment-centers': 'Investment Centers',
  '/admin/investments': 'Investments',
  '/admin/announcements': 'Announcements',
  '/admin/advertisements': 'Advertisements',
}

export default function AdminLayout() {
  const { signOut, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] ?? 'Admin'
  const { data: counts } = usePendingCounts()
  const countFor = (key?: CountKey) => (key && counts ? counts[key] : 0)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full bg-[#0a0a0a] text-gray-100">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-white/6 bg-[#111111]">
        {/* Brand */}
        <div className="relative flex h-14 items-center justify-center px-4 border-b border-white/6">
          <img src={logo} alt="Z-Scope" className="h-10 w-10 rounded-lg object-cover" />
          <span className="absolute right-4 rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400">
            ADMIN
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {nav.map(({ to, label, icon: Icon, end, badge }) => {
            const n = countFor(badge)
            return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                  isActive
                    ? 'bg-violet-600/15 text-violet-300'
                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                )
              }
            >
              <Icon size={15} />
              <span className="flex-1">{label}</span>
              {n > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{n > 99 ? '99+' : n}</span>
              )}
            </NavLink>
            )
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/6 p-2">
          <div className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-xs font-semibold text-violet-300">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-300">{profile?.full_name}</p>
              <p className="truncate text-[10px] text-gray-600">{profile?.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-gray-500 transition hover:bg-red-500/8 hover:text-red-400"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 min-w-0 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/6 bg-[#111111] px-4 md:px-6">
          <h1 className="text-sm font-semibold text-white md:text-base">{pageTitle}</h1>
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <NavLink to="/admin" end title={counts?.total ? `${counts.total} pending request${counts.total === 1 ? '' : 's'}` : 'No pending requests'} aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/5 hover:text-gray-200">
              <Bell size={18} />
              {!!counts?.total && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">{counts.total > 99 ? '99+' : counts.total}</span>
              )}
            </NavLink>
            {/* Mobile sign out */}
            <button onClick={handleSignOut} className="flex md:hidden items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition">
              <LogOut size={14} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex md:hidden fixed bottom-0 inset-x-0 border-t border-white/6 bg-[#111111]">
          {nav.map(({ to, label, icon: Icon, end, badge }) => {
            const n = countFor(badge)
            return (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              aria-label={label}
              className={({ isActive }) =>
                clsx(
                  'relative flex flex-1 items-center justify-center py-3 transition',
                  isActive ? 'text-violet-400' : 'text-gray-600'
                )
              }
            >
              <Icon size={20} />
              {n > 0 && (
                <span className="absolute right-1/2 top-1.5 ml-2 translate-x-3 rounded-full bg-red-500 px-1 text-[8px] font-semibold leading-4 text-white">{n > 9 ? '9+' : n}</span>
              )}
            </NavLink>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
