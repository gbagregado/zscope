import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  LayoutDashboard,
  List,
  PlusCircle,
  ArrowUpCircle,
  Megaphone,
  LogOut,
} from 'lucide-react'
import clsx from 'clsx'
import logo from '../assets/logo.jpeg'

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/dashboard/transactions', label: 'History', icon: List },
  { to: '/dashboard/add-funds', label: 'Add Funds', icon: PlusCircle },
  { to: '/dashboard/withdraw', label: 'Withdraw', icon: ArrowUpCircle },
  { to: '/dashboard/announcements', label: 'Updates', icon: Megaphone },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/transactions': 'Transaction History',
  '/dashboard/add-funds': 'Add Funds',
  '/dashboard/withdraw': 'Withdraw Funds',
  '/dashboard/announcements': 'Announcements',
}

export default function MemberLayout() {
  const { signOut, profile } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const pageTitle = pageTitles[location.pathname] ?? 'Dashboard'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full bg-[#0a0a0a] text-gray-100">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-52 shrink-0 flex-col border-r border-white/6 bg-[#111111]">
        {/* Brand */}
        <div className="flex h-14 items-center justify-center px-4 border-b border-white/6">
          <img src={logo} alt="Z-Scope" className="h-10 w-10 rounded-lg object-cover" />
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 p-2 pt-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
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
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-white/6 p-2">
          <div className="mb-1 flex items-center gap-2.5 rounded-lg px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/20 text-xs font-semibold text-violet-300">
              {profile?.full_name?.[0]?.toUpperCase() ?? 'M'}
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
          <button onClick={handleSignOut} className="flex md:hidden items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition">
            <LogOut size={14} />
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex md:hidden fixed bottom-0 inset-x-0 border-t border-white/6 bg-[#111111]">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[9px] font-medium uppercase tracking-wide transition',
                  isActive ? 'text-violet-400' : 'text-gray-600'
                )
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
