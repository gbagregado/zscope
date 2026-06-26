import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  Users,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  Megaphone,
  Image,
  LogOut,
  TrendingUp,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/payment-methods', label: 'Payment Methods', icon: CreditCard },
  { to: '/admin/payment-requests', label: 'Add Funds', icon: ArrowDownCircle },
  { to: '/admin/withdrawal-requests', label: 'Withdrawals', icon: ArrowUpCircle },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { to: '/admin/advertisements', label: 'Advertisements', icon: Image },
]

const pageTitles: Record<string, string> = {
  '/admin/members': 'Members',
  '/admin/payment-methods': 'Payment Methods',
  '/admin/payment-requests': 'Add Funds Requests',
  '/admin/withdrawal-requests': 'Withdrawal Requests',
  '/admin/announcements': 'Announcements',
  '/admin/advertisements': 'Advertisements',
}

export default function AdminLayout() {
  const { signOut, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] ?? 'Admin'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full bg-[#0a0a0a] text-gray-100">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-white/6 bg-[#111111]">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-4 border-b border-white/6">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
            <TrendingUp size={14} className="text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">ZScope</span>
          <span className="ml-auto rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400">
            ADMIN
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
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
              {label}
            </NavLink>
          ))}
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
          {/* Mobile sign out */}
          <button onClick={handleSignOut} className="flex md:hidden items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition">
            <LogOut size={14} />
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex md:hidden fixed bottom-0 inset-x-0 border-t border-white/6 bg-[#111111]">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[9px] font-medium uppercase tracking-wide transition',
                  isActive ? 'text-violet-400' : 'text-gray-600'
                )
              }
            >
              <Icon size={18} />
              <span>{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
