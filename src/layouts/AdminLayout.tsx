import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import {
  Users,
  CreditCard,
  ArrowDownCircle,
  ArrowUpCircle,
  Megaphone,
  LogOut,
} from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/admin/members', label: 'Members', icon: Users },
  { to: '/admin/payment-methods', label: 'Payment Methods', icon: CreditCard },
  { to: '/admin/payment-requests', label: 'Add Funds', icon: ArrowDownCircle },
  { to: '/admin/withdrawal-requests', label: 'Withdrawals', icon: ArrowUpCircle },
  { to: '/admin/announcements', label: 'Announcements', icon: Megaphone },
]

export default function AdminLayout() {
  const { signOut, profile } = useAuthStore()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full bg-[#0f0f0f] text-gray-100">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-56 flex-col border-r border-gray-800 bg-[#141414]">
        <div className="flex h-14 items-center px-4 border-b border-gray-800">
          <span className="text-violet-400 font-bold text-lg">ZScope</span>
          <span className="ml-2 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">Admin</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 truncate px-3 mb-2">{profile?.email}</p>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="flex md:hidden h-14 items-center justify-between px-4 border-b border-gray-800 bg-[#141414]">
          <span className="text-violet-400 font-bold">ZScope Admin</span>
          <button onClick={handleSignOut} className="text-gray-400 hover:text-red-400">
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="flex md:hidden border-t border-gray-800 bg-[#141414]">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] transition-colors',
                  isActive ? 'text-violet-400' : 'text-gray-500'
                )
              }
            >
              <Icon size={20} />
              <span className="leading-none">{label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
